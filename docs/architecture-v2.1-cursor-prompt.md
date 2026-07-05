# Cursor Prompt — Greenlit Architecture Formalization

**Paste this into Cursor after opening the `greenlit` repo.** Cursor should read the referenced files, then implement the changes as a single feature branch.

---

## Context

The Greenlit web MVP (`main` branch, live at greenlit-six.vercel.app) already implements a two-model conversational intake:
- **Interviewer** (`src/lib/ai/prompts/interviewer.md`) — generates plain-language questions
- **Diagnostician** (`src/lib/ai/prompts/diagnostician.md`) — analyzes evidence, produces briefs
- Turn limits: 3 rounds max, 6 questions max, confidence 0.75 force-done (`src/lib/intake/turnLimits.js`)
- Edge Function proxy: `supabase/functions/llm-proxy/`

The architecture is 80% right. Yash and his cofounder have locked in the remaining decisions in a design conversation. This PR formalizes them.

**Do NOT redesign the intake loop — it works. Make the targeted changes below.**

---

## Changes required

### 1. Vehicle context as a required first-class field

Currently `IntakeNew.jsx` jumps straight to modality picker. We need a **Step 0** that captures vehicle year/make/model/mileage before anything else. This context is critical to diagnostic accuracy (a 2008 Camry with 180K miles has a very different failure profile than a 2023 BMW with 8K).

**Implementation:**

- **Schema:** Add `vehicle` field to the `intakes` table via a new Supabase migration in `supabase/migrations/`. Shape:
  ```sql
  ALTER TABLE intakes ADD COLUMN vehicle jsonb;
  -- vehicle: { year: int, make: text, model: text, mileage: int | null, trim: text | null }
  ```
- **Client:** Add a `VehicleForm` component (`src/components/intake/VehicleForm.jsx`) with four fields: Year (number, required), Make (text w/ autocomplete from a hardcoded top-50 list, required), Model (text, required), Mileage (number, optional). Trim is not shown in v1 UI but reserved in schema.
- **Flow:** `IntakeNew.jsx` renders VehicleForm first. On submit, vehicle is passed to `createIntake({ shopSlug, vehicle })`. Modality picker becomes step 2.
- **DB layer:** Update `src/lib/db/intakes.js` `createIntake` to accept and persist vehicle. Update `getIntake` bundle to include it.
- **Diagnostician / Interviewer:** Both prompts should receive `vehicle` in their payload. Update `IntakeSession.jsx` to include `vehicle: bundle.intake.vehicle` in every `runInterviewer` / `runDiagnostician*` call. Update `interviewer.md` and `diagnostician.md` prompts to reference vehicle context ("Base your reasoning on the reported symptoms AND the specific vehicle — a 2008 Camry has very different likely failure modes than a 2023 EV").
- **Edge Function:** Update `supabase/functions/llm-proxy/schemas.ts` and `index.ts` to accept and forward vehicle.
- **Stub mode:** Update `src/lib/ai/stub.js` to accept vehicle in payload (no behavior change needed — stubs just log it).
- **Zod:** Add `VehicleSchema` to `src/lib/ai/schemas.js`, wire into `HypothesisSchema` payload validation on the request side (not the response side — vehicle is an input, not output).

**Acceptance:** Cannot start an intake without vehicle. Vehicle appears in the Diagnostician's payload and in the final brief.

### 2. Extract UI-selection logic into a deterministic rules layer

Currently the Interviewer LLM picks the UI component type (slider vs. multiple-choice vs. media_request) alongside the question text. Move UI selection out of the LLM into a deterministic table.

**Implementation:**

- **New file:** `src/lib/intake/uiRules.js` — exports `selectUIForIntent(intent) → UI object`.
- **New intent taxonomy:** Interviewer now emits a `question_intent` field alongside `prompt` and `rationale`. Intents are drawn from a fixed vocabulary:
  ```
  symptom_timing        → single_select
  symptom_location      → single_select
  symptom_duration      → single_select
  symptom_frequency     → single_select
  pedal_feel            → slider (0-10, stiff↔loose)
  steering_feel         → slider (0-10, easy↔resistant)
  vibration_intensity   → slider (0-10, none↔severe)
  vibration_location    → single_select
  warning_lights        → multi_select
  visible_damage        → media_request(photo)
  sound_capture         → media_request(audio)
  motion_capture        → media_request(video)
  safety_confirmation   → toggle
  freeform_description  → natural_language
  ```
- **Update Interviewer prompt** (`src/lib/ai/prompts/interviewer.md`): Remove the "UI element selection" section. Replace with instruction to emit `question_intent` from the fixed vocabulary. Add validation that the LLM must pick from the vocabulary — if it doesn't, fallback to `freeform_description`.
- **Update schemas.js:** `QuestionSchema` becomes:
  ```js
  {
    id: string,
    prompt: string,
    question_intent: enum([...]),  // new
    rationale: string,
    // ui: DERIVED — no longer LLM-emitted
  }
  ```
- **Client wiring:** In `IntakeSession.jsx` after receiving the interviewer response, map each question through `selectUIForIntent(q.question_intent)` before passing to `QuestionBatch`.
- **Edge Function schema:** Update `supabase/functions/llm-proxy/schemas.ts` to match. Interviewer LLM output is validated against the new schema.
- **Migration path:** Existing intakes in the DB have questions with the old `ui` field embedded. Add a compatibility shim in `IntakeSession.jsx` that uses `q.ui` if present, otherwise derives from `question_intent`. Don't break replay of old intakes.

**Acceptance:** Interviewer LLM never picks UI components. `uiRules.js` is the single source of truth for `question_intent → UI mapping`. Old intakes still render correctly.

### 3. Latency: batched Diagnostician firing (already correct — verify + document)

The Diagnostician correctly fires once per round in `IntakeSession.jsx`, not once per question. Add a comment block in `IntakeSession.jsx` above `runDiagnosticianRound` documenting this explicitly, so a future contributor doesn't "optimize" it into per-question firing.

Also: add response streaming for the final brief step. Currently `runDiagnosticianFinal` blocks the UI until the whole brief arrives. Wire the Edge Function to stream (Supabase Edge Functions support `TransformStream`), and update `BriefResult.jsx` to render fields progressively.

**Acceptance:** Comment block present. Final brief renders progressively (title/category first, then causes, then components, then estimate).

### 4. Model-swap seam for the fine-tuned Diagnostician (already stubbed — extend)

The Diagnostician prompt has a `<!-- TODO: Replace this prompt + endpoint with the fine-tuned Diagnostician model -->` marker. Extend this into an actual environment-swappable seam:

- Add `DIAGNOSTICIAN_MODEL_ID` to `supabase/functions/llm-proxy/` env vars. Default: `gpt-4o` (or whatever current default is). When set to a fine-tuned model ID, the Edge Function routes Diagnostician calls to that model.
- Add same for `INTERVIEWER_MODEL_ID` — likely different (cheaper) model.
- Document in `.env.example` and `supabase/README.md`.

**Acceptance:** `supabase secrets set DIAGNOSTICIAN_MODEL_ID=ft:...` swaps the model without code change.

### 5. Training data hooks (data pipeline scaffolding)

The mechanic outcome-rating flow already exists (`src/lib/db/ratings.js`). Add two lightweight hooks to make the data usable for training later:

- **Export endpoint:** New Edge Function `supabase/functions/export-training-data/index.ts`. Requires service-role auth. Returns JSONL where each row is:
  ```json
  {
    "intake_id": "...",
    "vehicle": {...},
    "messages": [...],           // full conversation
    "media_summary": [...],
    "brief": {...},              // final Diagnostician output
    "outcome": {                  // from intake_ratings
      "diagnosis_on_target": true | false,
      "actual_repair": "..."
    }
  }
  ```
  Only include intakes where `outcome` exists (mechanic has rated it). This becomes the labeled training set.

- **Annotation UI stub:** New page `src/pages/dev/AnnotationTool.jsx` (dev-only, behind AuthGate with admin check). Lists intakes with outcome ratings. Cofounder can view the full conversation, edit / add "next best question at each step" annotations. Persisted to a new `intake_annotations` table.
  ```sql
  CREATE TABLE intake_annotations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id uuid REFERENCES intakes(id),
    message_id uuid REFERENCES intake_messages(id),
    annotation jsonb,             -- { best_next_question: text, reasoning: text }
    annotated_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
  );
  ```
  RLS: only users with role 'annotator' or 'admin' can read/write.

**Acceptance:** Cofounder can log in, see rated intakes, add per-message annotations. Export endpoint returns training-ready JSONL.

### 6. Prompt updates (batched)

Update the Interviewer and Diagnostician prompts to reflect:
- Vehicle context is now available in the payload (both prompts reference it)
- Interviewer emits `question_intent` from fixed vocabulary, not `ui` (see change #2)
- Both prompts acknowledge they are the v2 rules-based / retrieval-augmented iteration, and that fine-tuning is planned but not active

---

## Constraints

- **Single branch, single PR.** Branch name: `arch/formalize-two-model-architecture`.
- **Do not break stub mode.** All acceptance items must pass with `VITE_LLM_STUB_MODE=true` and no `.env.local`.
- **Do not break existing intakes in the DB.** Add compatibility shims where schemas change.
- **Migrations are additive only** (add columns, add tables — don't drop or rename existing ones).
- **Update `docs/` accordingly:** Add `docs/architecture-v2.1.md` documenting the changes. Update `README.md` with a link.
- **Tests:** If tests exist, keep them green. If they don't, don't add a testing framework in this PR — just make the code work.

---

## Order of implementation (recommended)

1. Migration + vehicle field (change #1) — the foundation everything else builds on
2. Rules layer + intent vocabulary (change #2) — the biggest surface change
3. Prompt updates (change #6) — keep in sync with #1 and #2
4. Diagnostician / Interviewer model seam (change #4) — small, isolated
5. Latency batching comment + streaming (change #3) — small, isolated
6. Training data hooks (change #5) — new surface, doesn't touch existing flow

Ship as one PR. Verify the acceptance walkthrough from `docs/pr-v2-body.md` still passes end-to-end.

---

## Notes for Cursor

- The v2 acceptance walkthrough in `docs/pr-v2-body.md` is the canonical smoke test. If your changes break any of those 18 items, you've regressed.
- If any change conflicts with a design decision already made in the v2 code, **stop and ask** — don't override without confirmation.
- The stub mode in `src/lib/ai/stub.js` is used for demos to shops. Never leave stubs broken.
