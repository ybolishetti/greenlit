# Greenlit v2 — Implementation Plan

> **Status:** Plan only — awaiting approval before implementation.  
> **Branch:** `v2-supabase-ai-flow` (not yet created)  
> **Base:** Current repo — Vite + React 19 + Tailwind v4 SPA, localStorage-backed v1

---

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Commit sequence](#proposed-commit-sequence)
3. [File-by-file diff summary](#file-by-file-diff-summary)
4. [Database schema](#database-schema)
5. [Message contract (Zod)](#message-contract-zod)
6. [Intake flow state machine](#intake-flow-state-machine)
7. [System prompts](#system-prompts)
8. [Edge Function design](#edge-function-design-notes)
9. [Proposed deviations](#proposed-deviations)
10. [Questions before building](#questions-before-building)
11. [Acceptance mapping](#acceptance-mapping)

---

## Architecture overview

```mermaid
flowchart TB
  subgraph browser [Browser SPA]
    Picker[Step 0: Input Picker]
    Capture[Step 1: Capture + Upload]
    Loop[Step 2: Q&A Loop]
    Brief[/brief/:id]
    Dash[Shop Dashboard]
    Dev[/dev/intake/:id]
  end

  subgraph supabase [Supabase]
    DB[(Postgres + RLS)]
    Storage[(intake-media bucket)]
    EF[llm-proxy Edge Function]
  end

  subgraph llm [LLM - secrets only]
    IV[Interviewer gpt-4o-mini]
    DX[Diagnostician gpt-4o / fine-tuned TODO]
  end

  Picker --> Capture
  Capture -->|createIntake + uploadMedia| DB
  Capture -->|blobs| Storage
  Capture --> Loop
  Loop -->|appendMessage| DB
  Loop -->|interviewer / diagnostician| EF
  EF --> IV
  EF --> DX
  Loop -->|getIntake via EF| EF
  Brief -->|getIntake via EF| EF
  Dash -->|magic link + listShopIntakes| DB
  Dev -->|getIntake via EF| EF
```

**Session model:** Anon creates intake + messages/media (30-min window). Intake ID lives in React state / URL — no anon SELECT. Reads go through `llm-proxy` with a `get_intake` intent (service role server-side).

---

## Proposed commit sequence

Branch: **`v2-supabase-ai-flow`**

| # | Commit | Scope |
|---|--------|-------|
| 1 | `feat(supabase): initial schema, RLS, storage, seed` | Migration + README |
| 2 | `feat(supabase): llm-proxy edge function` | Edge Function + deploy docs |
| 3 | `feat(client): supabase wiring and db layer` | Client, `.env.example`, delete `storage.js` |
| 4 | `feat(ai): schemas, prompts, stub, interviewer/diagnostician clients` | `src/lib/ai/*` |
| 5 | `feat(intake): AI-driven flow with turn limits` | Intake pages + new components |
| 6 | `feat(ui): brand palette migration` | `index.css` + lime→brand sweep |
| 7 | `feat(dashboard): magic-link auth and Supabase ratings` | ShopDashboard + auth UI |
| 8 | `feat(dev): intake debug replay page` | `/dev/intake/:id` |
| 9 | `docs: README and acceptance walkthrough` | README + PR body |

---

## File-by-file diff summary

### New files

| File | Purpose |
|------|---------|
| `.env.example` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LLM_STUB_MODE` |
| `supabase/migrations/0001_initial_schema.sql` | Locked schema + RLS + storage policies + `demo-shop` seed |
| `supabase/README.md` | Setup, envs, RLS caveats, prod checklist, Edge Function deploy |
| `supabase/functions/llm-proxy/index.ts` | LLM proxy + `get_intake` + `signed_url` |
| `supabase/functions/llm-proxy/prompts/interviewer.md` | Bundled copy of client prompt (Edge Function reads at deploy) |
| `supabase/functions/llm-proxy/prompts/diagnostician.md` | Same |
| `src/lib/supabase.js` | Singleton `@supabase/supabase-js` client |
| `src/lib/db/index.js` | Re-exports all db functions |
| `src/lib/db/intakes.js` | `createIntake`, `getIntake`, `listShopIntakes` |
| `src/lib/db/messages.js` | `appendMessage` |
| `src/lib/db/media.js` | `uploadMedia` |
| `src/lib/db/ratings.js` | `saveRating` |
| `src/lib/db/auth.js` | `signInWithMagicLink`, `signOut`, `getSession` |
| `src/lib/db/edge.js` | Shared Edge Function invoke helper + error handling |
| `src/lib/ai/schemas.js` | Zod schemas for all message contract shapes |
| `src/lib/ai/client.js` | Calls Edge Function; auto-falls back to stub |
| `src/lib/ai/interviewer.js` | Build payload, validate response, retry logic |
| `src/lib/ai/diagnostician.js` | Hypothesis + final calls |
| `src/lib/ai/stub.js` | Deterministic 2-round script → `mockDiagnosis.generateBrief` |
| `src/lib/ai/prompts/interviewer.md` | Editable system prompt (`?raw` in Vite) |
| `src/lib/ai/prompts/diagnostician.md` | Editable system prompt |
| `src/lib/intake/turnLimits.js` | Pure functions: round/question caps, forced-done |
| `src/lib/intake/sessionCache.js` | In-memory intake ID cache for anon reads |
| `src/components/InputPicker.jsx` | Step 0 — 4 modality cards |
| `src/components/VideoRecorder.jsx` | MediaRecorder video capture + upload hook |
| `src/components/intake/QuestionBatch.jsx` | Renders one batch of Interviewer questions |
| `src/components/intake/QuestionField.jsx` | Per-UI-type renderer (select, slider, toggle, NL, media_request) |
| `src/components/intake/ConversationProgress.jsx` | Round + question counter |
| `src/components/ErrorBanner.jsx` | Inline error + retry/skip |
| `src/components/AuthGate.jsx` | Magic-link login wrapper for dashboard |
| `src/pages/intake/IntakeNew.jsx` | Picker + capture (replaces linear 5-step) |
| `src/pages/intake/IntakeSession.jsx` | `/intake/:id` conversational loop + resume |
| `src/pages/dev/IntakeDebug.jsx` | Raw log replay |

### Modified files

| File | Changes |
|------|---------|
| `package.json` | Add `@supabase/supabase-js`, `zod` |
| `README.md` | Chrome recommendation, Supabase/Edge setup, env matrix, limitations |
| `src/index.css` | New token table; `--color-brand*`; text tokens; `range-brand`; remove lime/panel-2 |
| `src/App.jsx` | Routes: `/intake` → `IntakeNew`, `/intake/:id` → `IntakeSession`, `/dev/intake/:id` → debug (dev-gated) |
| `src/pages/BriefResult.jsx` | Load via `getIntake()` Edge Function; render `intake.brief` JSON; palette |
| `src/pages/ShopDashboard.jsx` | `AuthGate` + magic link; `listShopIntakes` + `saveRating`; brief from `intake.brief`; palette |
| `src/pages/ShopLanding.jsx` | Optional `shops` name lookup; palette |
| `src/pages/Landing.jsx` | Update copy for AI flow; palette |
| `src/components/AudioRecorder.jsx` | Return `blob` via `onCapture(blob)`; palette |
| `src/components/PhotoUpload.jsx` | Return `File[]` via `onCapture`; palette |
| `src/components/FeelSlider.jsx` | `range-brand`, palette |
| `src/components/OptionCard.jsx` | `brand` classes |
| `src/components/Navbar.jsx` | Palette |
| `src/components/Logo.jsx` | `bg-brand` |
| `src/components/DownloadAppButton.jsx` | Palette only — **handleClick stays inert** |

### Deleted files

| File | Reason |
|------|--------|
| `src/lib/storage.js` | Replaced by Supabase db layer (spec: no dual-write) |
| `src/pages/intake/IntakeFlow.jsx` | Replaced by `IntakeNew` + `IntakeSession` |

### Unchanged (by design)

| File | Notes |
|------|-------|
| `src/lib/mockDiagnosis.js` | Kept intact; stub uses `generateBrief`; option constants may be referenced by stub mapping |
| `src/components/DownloadAppButton.jsx` | Inert click handler preserved |
| `vite.config.js` | No changes needed (`?raw` works out of the box) |

---

## Database schema

Proposed columns for `0001_initial_schema.sql`. Table names are locked per spec; column details proposed here for approval.

```sql
-- shops
id          text PRIMARY KEY          -- 'demo-shop' preserves existing URLs
name        text NOT NULL
created_at  timestamptz DEFAULT now()

-- shop_members
shop_id     text REFERENCES shops(id)
user_id     uuid REFERENCES auth.users(id)
role        text DEFAULT 'member'      -- 'owner' | 'member'
PRIMARY KEY (shop_id, user_id)

-- intakes
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
shop_id     text REFERENCES shops(id)  -- nullable for direct /intake
status      text DEFAULT 'in_progress' -- in_progress | complete
brief       jsonb                       -- Diagnostician final output
customer_name text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()

-- intake_messages
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
intake_id   uuid REFERENCES intakes(id) ON DELETE CASCADE
role        text CHECK (role IN ('user','interviewer','diagnostician','system'))
content     jsonb NOT NULL
created_at  timestamptz DEFAULT now()

-- intake_media
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
intake_id   uuid REFERENCES intakes(id) ON DELETE CASCADE
kind        text CHECK (kind IN ('audio','video','photo','text'))
storage_path text                       -- nullable for kind='text'
text_content text                       -- for kind='text'
mime_type   text
created_at  timestamptz DEFAULT now()

-- intake_ratings
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
intake_id   uuid REFERENCES intakes(id) UNIQUE
rated_by    uuid REFERENCES auth.users(id)
on_target   text CHECK (on_target IN ('yes','partially','no'))
repair_performed text
created_at  timestamptz DEFAULT now()
```

### RLS summary

| Table | Anon | Authed shop member |
|-------|------|-------------------|
| `shops` | SELECT | SELECT |
| `shop_members` | — | SELECT (same shop) |
| `intakes` | INSERT only | SELECT/UPDATE (own shop) |
| `intake_messages` | INSERT (intake ≤ 30 min old) | SELECT (own shop) |
| `intake_media` | INSERT (intake ≤ 30 min old) | SELECT (own shop) |
| `intake_ratings` | — | INSERT/SELECT (own shop) |

### Storage

- Bucket: `intake-media` (private)
- Path: `{intake_id}/{media_id}.{ext}`
- Anon INSERT under prefix during 30-min window
- Reads via 5-min signed URLs from Edge Function

### Seed

- `demo-shop` shop row at end of `0001`

---

## Message contract (Zod)

Stored in `intake_messages.content`. Validated in `src/lib/ai/schemas.js`.

### Interviewer (role: `interviewer`)

```typescript
QuestionBatch = {
  type: 'question_batch',
  round: number,           // 1–3
  questions: Question[],   // 1–3 per batch
}

Question = {
  id: string,
  prompt: string,
  ui: SingleSelect | MultiSelect | Slider | Toggle | NaturalLanguage | MediaRequest,
  rationale: string,
}

Done = { type: 'done' }
```

### User (role: `user`)

```typescript
UserAnswer = {
  type: 'answer',
  answer_to: string,       // question.id
  value: string | string[] | number | boolean,
  free_text?: string,
}
```

### Diagnostician (role: `diagnostician`)

```typescript
Hypothesis = {
  type: 'hypothesis',
  round: number,
  confidence: number,      // 0.0–1.0
  needs_more_info: string[],
  top_causes?: { cause: string, confidence: number }[],
}

FinalBrief = {
  type: 'final',
  category: string,
  urgency: 'immediate' | 'monitor' | 'routine',
  urgencyLabel: string,
  probableCauses: { cause: string, confidence: number }[],  // 0–100 for UI
  componentsToInspect: string[],
  estimateRange: [number, number],
  symptomLanguage: string[],   // MUST include verbatim customer quotes
  disclaimer: string,
  inputs: { audio: boolean, photo: boolean, video: boolean, text: boolean },
}
```

### System (role: `system`)

```typescript
SystemEvent = {
  type: 'system_event',
  event: 'round_start' | 'round_end' | 'forced_done' | 'validation_failed' | 'ai_error' | 'stub_mode',
  round?: number,
  details?: Record<string, unknown>,  // includes raw LLM output on validation_failed
}
```

### Turn-limit enforcement

Client-side in `turnLimits.js`, logged as `system_event`:

- `totalQuestionsAsked ≤ 6`
- `currentRound ≤ 3`
- `questionsInBatch ≤ 3`
- After each Diagnostician hypothesis: if `confidence ≥ 0.75` → set `forceDone = true` before next Interviewer call
- Interviewer receives `forceDone` in payload; must return `{ type: 'done' }`

---

## Intake flow state machine

```
/intake?shop=demo-shop
  └─ Step 0: InputPicker (audio | video | photo | text)
  └─ Step 1: Capture → createIntake() → uploadMedia() → appendMessage(system: intake_started)
  └─ navigate → /intake/:id

/intake/:id
  └─ Load via getIntake() (Edge Function)
  └─ If status=complete → redirect /brief/:id
  └─ Loop:
       1. runInterviewer() → question_batch | done
       2. Render batch; user answers → appendMessage(user) each
       3. runDiagnostician(hypothesis) → appendMessage(diagnostician)
       4. Check turn limits + confidence → continue or force done
       5. If done → runDiagnostician(final) → save brief → status=complete → /brief/:id
```

**Resume:** Reloading `/intake/:id` replays messages from DB, reconstructs state (current round, answers, last hypothesis).

**Stub path:** `VITE_LLM_STUB_MODE=true` OR Edge Function unreachable → `stub.js` runs fixed 2-round script without network.

---

## System prompts

### Interviewer — `src/lib/ai/prompts/interviewer.md`

```markdown
# Interviewer — Greenlit Intake

You are the Interviewer for Greenlit, a service that helps car owners describe vehicle problems in plain language and produces a mechanic-ready diagnostic brief. Your job is to ask the driver short, concrete questions that reduce diagnostic uncertainty. You never diagnose — you only gather observable facts.

## Inputs you receive

Each request includes:
- `round` (1–3): current interview round
- `total_questions_asked` (0–6): questions already asked across all rounds
- `force_done` (boolean): if true, you MUST return `{ "type": "done" }` immediately
- `last_hypothesis`: the Diagnostician's most recent output (confidence, needs_more_info, top_causes)
- `media_summary`: list of attached media (audio, video, photo, text) with descriptions or transcripts if available
- `conversation`: prior messages (your questions, user answers, system events)

## Output format

Respond with **JSON only**. No markdown, no prose, no code fences. Exactly one of:

### Question batch
{
  "type": "question_batch",
  "round": 1,
  "questions": [ /* 1–3 Question objects */ ]
}

### Done
{ "type": "done" }

Return `{ "type": "done" }` when ANY of these is true:
- `force_done` is true
- You believe further questions will not meaningfully change diagnostic confidence
- The Diagnostician's confidence is already ≥ 0.75 (check `last_hypothesis`)
- You have no remaining high-value gaps from `needs_more_info`

## Question object shape

{
  "id": "q_<unique>",
  "prompt": "Plain-language question text",
  "ui": { /* UI element — see below */ },
  "rationale": "One sentence: why this question helps"
}

## UI element selection

Choose the UI that makes answering easiest and most precise:

| UI type | When to use | Shape |
|---------|-------------|-------|
| `single_select` | 3–6 discrete, mutually exclusive options | `{ "type": "single_select", "options": [{ "value": "...", "label": "..." }] }` |
| `multi_select` | Multiple options may apply | `{ "type": "multi_select", "options": [...] }` |
| `slider` | Intensity, degree, or frequency on a scale | `{ "type": "slider", "min": 0, "max": 10, "step": 1, "lowLabel": "...", "highLabel": "..." }` |
| `toggle` | Binary yes/no | `{ "type": "toggle", "trueLabel": "Yes", "falseLabel": "No" }` |
| `natural_language` | The driver's exact words matter; open-ended | `{ "type": "natural_language", "placeholder": "..." }` |
| `media_request` | A photo/audio/video would meaningfully help (≥0.1 confidence gain) | `{ "type": "media_request", "kind": "audio" \| "video" \| "photo", "prompt": "..." }` |

### Examples

**single_select** — "When does the noise happen?"
Options: Starting the car, Braking, Turning, Accelerating, At highway speed, Going over bumps, All the time

**multi_select** — "Which warning lights are on?"
Options: Check engine, Battery, Oil pressure, ABS/brake, Other, None

**slider** — "How strong is the vibration?"
min: 0, max: 10, lowLabel: "Barely noticeable", highLabel: "Very strong"

**toggle** — "Does the noise get louder when you accelerate?"
trueLabel: "Yes", falseLabel: "No"

**natural_language** — "Describe the sound in your own words — what does it remind you of?"
placeholder: "e.g. metal scraping, rattling marbles, deep thump..."

**media_request** — Only when visual or audio evidence would move confidence by at least 0.1.
kind: "photo", prompt: "Can you take a photo of the dashboard warning lights?"

## Question quality rules

1. **Concrete and sensory, not technical.** Ask what the driver sees, hears, feels, or smells — not part names or OBD codes.
2. **One thing per prompt.** Do not combine "when does it happen AND how long has it been going on" in one question.
3. **Address the top 1–2 gaps** from `last_hypothesis.needs_more_info`. Ignore lower-priority gaps if question budget is tight.
4. **Never invent facts.** Only ask about things the driver can directly observe. Do not assume make, model, mileage, or repair history unless the driver mentioned them.
5. **Never diagnose or suggest causes.** Do not say "this sounds like a bad alternator."
6. **Use plain language.** Avoid jargon: say "grinding noise when you brake" not "rotor contact patch irregularity."

## Batching rules

- Return **2–3 questions per batch** (never more than 3).
- **Round 1 almost always has 3 questions** unless `force_done` is true or only 1–2 high-value gaps exist.
- Rounds 2–3: 2–3 questions targeting remaining `needs_more_info`.
- Total questions across all rounds must not exceed 6 (check `total_questions_asked`).

## Relationship to the Diagnostician

You do not produce hypotheses or confidence scores. The Diagnostician runs once per round after the driver answers your batch. Use `last_hypothesis.needs_more_info` to prioritize your next questions. If confidence is ≥ 0.75, return done unless a critical safety gap remains (e.g., "can you still stop the car safely?").

## Safety

If the driver describes loss of braking, steering, or consciousness-level symptoms (smoke, fuel smell, fire), include a toggle or natural_language question confirming whether the vehicle is safe to drive, and prioritize that in the batch.
```

### Diagnostician — `src/lib/ai/prompts/diagnostician.md`

```markdown
# Diagnostician — Greenlit Intake

You are the Diagnostician for Greenlit. You analyze a car owner's reported symptoms — including audio, video, photo, free-text descriptions, and structured Q&A — and produce either a running hypothesis (mid-intake) or a final mechanic-ready brief. You translate the driver's plain language into actionable diagnostic guidance for a professional mechanic.

## Inputs you receive

Each request includes an `intent`:
- `diagnostician_hypothesis` — mid-intake analysis after a round of Q&A
- `diagnostician_final` — produce the final brief; no more questions will be asked

Also included:
- `round` (1–3)
- `media_summary`: attached media with descriptions/transcripts
- `conversation`: full message log (user answers, interviewer questions, prior hypotheses)

## Output format

Respond with **JSON only**. No markdown, no prose, no code fences.

### Hypothesis (intent: diagnostician_hypothesis)

{
  "type": "hypothesis",
  "round": 1,
  "confidence": 0.45,
  "needs_more_info": [
    "When exactly the noise occurs (braking vs turning vs idle)",
    "Whether any dashboard warning lights are illuminated"
  ],
  "top_causes": [
    { "cause": "Worn brake pads with wear indicator contact", "confidence": 0.35 },
    { "cause": "Glazed rotor surface", "confidence": 0.10 }
  ]
}

- `confidence`: 0.0–1.0, your overall certainty that the top cause is correct
- `needs_more_info`: 2–5 specific, observable gaps that would most increase confidence
- `top_causes`: up to 3 ranked probable causes with individual confidence (need not sum to 1.0)

### Final brief (intent: diagnostician_final)

{
  "type": "final",
  "category": "Brakes",
  "urgency": "monitor",
  "urgencyLabel": "Monitor closely",
  "probableCauses": [
    { "cause": "Worn brake pads (wear indicator contact)", "confidence": 80 },
    { "cause": "Glazed or contaminated rotor surface", "confidence": 12 }
  ],
  "componentsToInspect": ["Front & rear brake pads", "Rotor surface", "Caliper hardware"],
  "estimateRange": [150, 380],
  "symptomLanguage": [
    "\"High pitched squeal every time I brake, especially in the morning.\"",
    "Occurs while braking",
    "Started: A few weeks ago"
  ],
  "disclaimer": "This brief is a triage aid based on the customer's self-reported symptoms. It is not a diagnosis. A qualified mechanic must inspect the vehicle before any repair is performed.",
  "inputs": { "audio": true, "photo": false, "video": false, "text": true }
}

## Urgency labeling

| Key | Label | Criteria |
|-----|-------|----------|
| `immediate` | Immediate safety risk | Driving the vehicle poses a safety risk: brake failure, steering loss, fuel leak, smoke, overheating, sudden power loss at speed, tire failure |
| `monitor` | Monitor closely | Symptom affects drivability or may worsen; schedule service soon but not an emergency stop |
| `routine` | Routine service | Cosmetic, minor, or long-standing issues with no safety impact |

Escalate urgency if:
- A relevant warning light is reported (check engine, oil, battery, ABS)
- The issue has persisted for months without attention
- The driver reports the symptom is getting worse

## Final brief requirements

1. **symptomLanguage MUST include the customer's exact quoted language.** Copy verbatim phrases from user messages and free-text fields, wrapped in quotation marks. Also include structured context (timing, duration) derived from answers.
2. **probableCauses.confidence** is 0–100 (integer percentage) for the final brief.
3. **componentsToInspect** lists what the mechanic should check first — ordered by likelihood.
4. **estimateRange** is a realistic USD repair range `[low, high]` for the most likely cause.
5. **disclaimer** is required and must state this is triage, not a diagnosis.
6. **inputs** reflects which media types were actually attached.

## Analysis rules

1. Base conclusions only on provided evidence. Do not assume vehicle make, model, year, or mileage unless stated.
2. Prefer common, observable failure modes over exotic diagnoses.
3. When evidence is thin, say so — lower confidence and list specific needs_more_info rather than guessing.
4. Distinguish correlated symptoms from causal ones.
5. For hypothesis rounds, be honest about uncertainty. A confidence of 0.3 with clear needs_more_info is better than false certainty.

## Relationship to the Interviewer

After each hypothesis, the Interviewer uses your `needs_more_info` to ask the next question batch. Write needs_more_info as concrete, observable questions the driver can answer — not internal mechanic steps.

## Fine-tuned model placeholder

<!-- TODO: Replace this prompt + endpoint with the fine-tuned Diagnostician model trained on intake_messages + intakes.brief + intake_ratings outcome labels. -->
```

---

## Edge Function design notes

### Intents

| Intent | Caller | Action |
|--------|--------|--------|
| `interviewer` | Anon (with intake_id) | Forward to OpenAI, return validated JSON |
| `diagnostician_hypothesis` | Anon | Forward to Diagnostician endpoint |
| `diagnostician_final` | Anon | Forward; persist `intakes.brief` server-side |
| `get_intake` | Anon (created ≤30 min) OR shop_member | Service-role fetch + signed URLs |
| `signed_url` | Same | 5-min signed URL for one `storage_path` |

### Secrets

- `OPENAI_API_KEY`
- `DIAGNOSTICIAN_API_URL` (defaults to OpenAI)
- `DIAGNOSTICIAN_API_KEY` (falls back to OpenAI key)
- `SUPABASE_SERVICE_ROLE_KEY`

### Models

- Interviewer → `gpt-4o-mini`
- Diagnostician → `gpt-4o` (env-swappable; TODO for fine-tuned model)

### Rate limit

In-memory map per isolate: **20 calls / 5 min / intake_id**. Returns 429 with retry-after.

### Validation

- Edge Function: lightweight JSON parse
- Client: full Zod validation
- On Zod fail → retry once with validation error → second fail → fallback NL question + `system_event`

### Prompt sync

Duplicate prompts in `supabase/functions/llm-proxy/prompts/` — deploy copies from `src/lib/ai/prompts/` (manual sync documented in README).

---

## Color palette (Track 3)

| Token | Hex | Use |
|-------|-----|-----|
| `--brand` | `#4CAF6B` | Primary CTA, matches business plan header |
| `--brand-dim` | `#3F9558` | Hover/pressed |
| `--brand-soft` | `#4CAF6B14` | Tinted panels (8% alpha) |
| `--ink` | `#0F1613` | App background (deep forest-black) |
| `--panel` | `#161E1B` | Card background |
| `--line` | `#26312D` | Borders |
| `--text` | `#EDF3EF` | Primary text |
| `--text-dim` | `#EDF3EF99` | Secondary (60%) |
| `--text-mute` | `#EDF3EF66` | Tertiary (40%) |
| `--ok` | `#4CAF6B` | Success (aliased to brand) |
| `--warn` | `#E0B341` | Monitor |
| `--danger` | `#D46A5B` | Immediate — desaturated |

Purge all `lime` classes and hex refs. Rename `lime` → `brand` everywhere.

---

## Proposed deviations

| # | Deviation | Why | Tradeoff |
|---|-----------|-----|----------|
| 1 | **`get_intake` Edge Function intent** (not in spec list) | Anon cannot SELECT; client must read intake somehow | Small spec extension; cleanest path vs. baking service role into client |
| 2 | **Text-only media summaries to LLM** (not raw audio/image bytes in v2) | Edge Function + gpt-4o vision/audio adds complexity; stub/demo works without | Diagnostician won't "hear" audio in v2; uses metadata + user answers. Upgrade path: pass signed URLs to vision/audio API later |
| 3 | **`shops.id` as text slug** (`demo-shop`) not UUID | Preserves existing URLs `/shop/demo-shop` | Non-standard vs UUID; fine for v2 demo |
| 4 | **Duplicate prompts** in Edge Function folder | Deno can't import Vite `?raw` | Manual sync; documented in README |
| 5 | **`intakes.brief` persisted by Edge Function** on `diagnostician_final` | Ensures brief exists even if client disconnects | Client also writes status=complete; idempotent update |
| 6 | **Shop name on QR page** from `shops` table | Anon SELECT allowed on shops | ShopLanding adds one Supabase query; fallback to slug formatting |
| 7 | **No `zod` in Edge Function** | Keep Deno deps minimal | Validation only on client; Edge Function trusts OpenAI JSON mode |

---

## Questions before building

1. **Shop IDs:** OK to use text slug `demo-shop` as primary key (preserves URLs), or switch to UUID + slug column?

2. **Multimodal depth for v2:** Accept text summaries only for LLM context (deviation #2), or require passing signed image URLs to gpt-4o vision now?

3. **`get_intake` intent:** Approve this Edge Function read path, or prefer a different mechanism?

4. **Customer name:** Collect optional name at end of intake (preserved from v1), or drop until later?

5. **Demo shop auth:** Seed a test shop member tied to a specific email (e.g. `demo@greenlit.app`), or rely on manual member creation post-migration?

6. **Brief PDF colors:** Update PDF green from `[40,110,20]` to brand `#4CAF6B` → `[76,175,107]`?

7. **Message contract:** Does the proposed Zod shape above match your locked schema, or is there a canonical JSON Schema file to import verbatim?

---

## Acceptance mapping

| Item | Verification approach |
|------|------------------------|
| Boots without `.env.local` | Stub mode; no console errors |
| No `lime` in `src/` | `grep -R "lime" src/` |
| 4 modalities → Storage | Manual Chrome walkthrough |
| Turn limits | Unit tests in `turnLimits.js` + manual |
| Anon no SELECT | Supabase client `.from('intakes').select()` → RLS error in console |
| 30-min INSERT window | SQL/integration test or manual with backdated intake |
| Storage 403 / signed URL | curl public URL vs signed |
| Dashboard magic link | Login flow + cross-session rating |
| Zod fail → fallback | Force bad response in stub test mode |
| `/dev/intake/:id` | Dev server + `?debug=1` with auth |
| `VITE_LLM_STUB_MODE` toggle | Env flip, no code change |
| Fresh migration | `supabase db reset` on clean project |

---

## Non-negotiables (from spec)

- No unrequested features. React state + Supabase only.
- Leave iOS `DownloadAppButton` inert.
- Preserve outcome-rating loop → `intake_ratings`.
- Preserve QR/shop-landing flow.
- Demo runs without LLM key via stub.
- LLM key only in Edge Function secrets.
- Don't delete `mockDiagnosis.js`.
- Diagnostician is placeholder for future fine-tuned model. TODO markers everywhere the swap happens.
- Recommended browser: **Chrome** (desktop or Android). Note in README. iOS Safari MediaRecorder issues deferred.

---

*Generated for review — reply with approvals and answers to the questions above to begin implementation.*
