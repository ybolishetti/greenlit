# Greenlit Architecture v2.1 — Two-Model Formalization

**Status:** Design locked 2026-07-05, implementation pending
**Supersedes:** No prior architecture doc; this formalizes design decisions layered onto the v2 codebase
**Companion files:**
- `docs/architecture-v2.1-cursor-prompt.md` — implementation task for Cursor (paste this into Cursor to execute)
- `docs/architecture-v2.1-business-context.md` — business plan amendment for full strategic context

---

## Executive summary

Greenlit's AI system is a **two-model + deterministic-rules-layer architecture**. The v2 code (`main` branch as of 4115c7e) already implements ~80% of this design. This document formalizes the remaining decisions and specifies the changes needed to close the gaps.

The v2 branch already ships:
- **Interviewer** prompt + LLM call (`src/lib/ai/prompts/interviewer.md`, `client.js#runInterviewer`)
- **Diagnostician** prompt + LLM calls (hypothesis mid-intake, final brief at end) (`src/lib/ai/prompts/diagnostician.md`, `client.js#runDiagnostician*`)
- Turn limits: 3 rounds max, 6 questions max, 0.75 confidence force-done (`src/lib/intake/turnLimits.js`)
- Zod-validated message contracts (`src/lib/ai/schemas.js`)
- Deterministic stub mode for demos (`src/lib/ai/stub.js`)
- Edge Function proxy (`supabase/functions/llm-proxy/`) with server-side schema validation
- Mechanic outcome-rating flow (`src/lib/db/ratings.js`)

The v2.1 gaps to close (see companion Cursor prompt for line-item spec):
1. **Vehicle context** as a required Step 0 field (year / make / model / mileage)
2. **UI selection rules layer** — extract UI element choice from Interviewer LLM into a deterministic table keyed on `question_intent`
3. **Streaming final brief** for progressive UI render
4. **Env-swappable model IDs** for both Interviewer and Diagnostician (fine-tune-swap seam)
5. **Training data pipeline** — export endpoint for outcome-rated intakes + annotation UI stub for cofounder labeling
6. **Prompt updates** to reflect vehicle context and new intent vocabulary

---

## Component roles

### Diagnostician (Model B) — the diagnostic brain

Never speaks to the user. Ingests all captured symptom evidence (audio metadata, video metadata, photo metadata, sliders, text, prior Q&A) plus vehicle context, and produces either:

- A **running hypothesis** (mid-intake) — current confidence, top ranked causes, and `needs_more_info` gaps
- A **final brief** (end-of-intake) — ranked causes with 0-100 confidence, urgency (`immediate` / `monitor` / `routine`), components to inspect, customer's exact language preserved, disclaimer

Domain-specific fine-tuning target. Env-swappable via `DIAGNOSTICIAN_MODEL_ID`.

### Interviewer (Model A) — the user-facing question layer

Takes the Diagnostician's identified information gaps and produces plain-language, non-technical questions. Never performs diagnostic reasoning. Emits a `question_intent` string from a fixed vocabulary — does NOT pick the UI component type (that's the rules layer's job).

Substantially smaller/cheaper model acceptable. Env-swappable via `INTERVIEWER_MODEL_ID`.

### Rules Layer — deterministic UI selection

Single-file lookup table (`src/lib/intake/uiRules.js`) that maps `question_intent → UI component definition`. Not an LLM. This is where slider ranges, multi-select cardinality, and media-request kinds are decided.

Intent vocabulary (v2.1):

| Intent | UI type | Notes |
|--------|---------|-------|
| `symptom_timing` | `single_select` | When does it happen? (cold start, highway, braking, turning, etc.) |
| `symptom_location` | `single_select` | Where do you notice it? (front-left, rear, under hood, etc.) |
| `symptom_duration` | `single_select` | Since when? (today, week, month, longer) |
| `symptom_frequency` | `single_select` | How often? (always, sometimes, only when X) |
| `pedal_feel` | `slider` | 0=loose, 10=stiff |
| `steering_feel` | `slider` | 0=easy, 10=resistant |
| `vibration_intensity` | `slider` | 0=none, 10=severe |
| `vibration_location` | `single_select` | Steering wheel, seat, pedals, whole car |
| `warning_lights` | `multi_select` | Check engine, ABS, oil, battery, other |
| `visible_damage` | `media_request` | kind=photo |
| `sound_capture` | `media_request` | kind=audio |
| `motion_capture` | `media_request` | kind=video |
| `safety_confirmation` | `toggle` | Vehicle safe to drive? (for safety-critical symptoms) |
| `freeform_description` | `natural_language` | Fallback when nothing else fits |

---

## Runtime flow

```
┌────────────────────────────────────────────────────────────┐
│ Step 0: Vehicle context capture                             │
│   VehicleForm → { year, make, model, mileage }              │
│   Persisted to intakes.vehicle (jsonb)                      │
└────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────┐
│ Step 1: Initial multimodal capture                          │
│   InputPicker → audio | video | photo | text                │
│   Uploaded to intake_media                                  │
└────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────┐
│ Cycle loop (max 3 rounds, max 6 questions total)            │
│                                                              │
│   ┌────────────────────────────────────────────────┐        │
│   │ Diagnostician (once per cycle)                  │        │
│   │   Input: vehicle + media_summary + conversation │        │
│   │   Output: { confidence, top_causes,             │        │
│   │             needs_more_info[] }                 │        │
│   └────────────────────────────────────────────────┘        │
│                       ↓                                      │
│   ┌────────────────────────────────────────────────┐        │
│   │ Interviewer (once per cycle)                    │        │
│   │   Input: vehicle + media_summary + conversation │        │
│   │          + last_hypothesis + force_done         │        │
│   │   Output: { questions: [{ id, prompt,           │        │
│   │             question_intent, rationale }] }     │        │
│   └────────────────────────────────────────────────┘        │
│                       ↓                                      │
│   ┌────────────────────────────────────────────────┐        │
│   │ Rules layer (deterministic, per question)       │        │
│   │   uiRules.selectUIForIntent(question_intent)    │        │
│   │   → { ui: { type, ...uiParams } }               │        │
│   └────────────────────────────────────────────────┘        │
│                       ↓                                      │
│   ┌────────────────────────────────────────────────┐        │
│   │ QuestionBatch UI (client)                       │        │
│   │   Renders 2–3 questions to user, collects       │        │
│   │   answers, appends to conversation              │        │
│   └────────────────────────────────────────────────┘        │
│                       ↓                                      │
│              Termination check                              │
│              (see triggers below)                           │
│                       ↓                                      │
│              Loop OR proceed to final                       │
└────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────┐
│ Final brief generation                                       │
│   Diagnostician (intent=diagnostician_final)                │
│   Output streamed to BriefResult page                       │
│   Persisted to intakes.brief                                │
└────────────────────────────────────────────────────────────┘
```

### Termination triggers (any)
- `last_hypothesis.confidence >= 0.75`
- `current_round >= 3`
- `total_questions_asked >= 6`
- User taps "Done"

### Firing cadence
- **Diagnostician: once per cycle**, not per question. Batching keeps latency and cost sane and mirrors how mechanics reason (integrate a chunk of new info, then re-hypothesize).
- **Interviewer: once per cycle**, produces the batch of 2-3 questions for that round.
- **Rules layer: once per question**, deterministic, sub-millisecond.

---

## Data flow: what each component sees

### Diagnostician payload
```json
{
  "intent": "diagnostician_hypothesis" | "diagnostician_final",
  "round": 1 | 2 | 3,
  "vehicle": { "year": 2015, "make": "Toyota", "model": "Camry", "mileage": 145000 },
  "media_summary": [
    { "kind": "audio", "duration_seconds": 12.4, "media_id": "..." },
    { "kind": "text", "text_content": "..." }
  ],
  "conversation": [{ "role": "...", "content": {...} }, ...]
}
```

### Interviewer payload
```json
{
  "round": 1 | 2 | 3,
  "total_questions_asked": 0..6,
  "force_done": false,
  "vehicle": { ... },
  "last_hypothesis": { "confidence": 0.42, "needs_more_info": [...] } | null,
  "media_summary": [...],
  "conversation": [...]
}
```

### Interviewer response
```json
{
  "type": "question_batch",
  "round": 1,
  "questions": [
    {
      "id": "q_1",
      "prompt": "When you press the brake pedal, does it feel loose or stiff?",
      "question_intent": "pedal_feel",
      "rationale": "Narrows between worn pads vs. hydraulic issue."
    }
  ]
}
// or
{ "type": "done" }
```

Note the `ui` field is **derived by the rules layer**, not emitted by the Interviewer.

---

## Model-swap seam

Both models are swappable at deploy time via Supabase Edge Function environment variables:

```bash
supabase secrets set INTERVIEWER_MODEL_ID=gpt-4o-mini
supabase secrets set DIAGNOSTICIAN_MODEL_ID=gpt-4o
# Later:
supabase secrets set DIAGNOSTICIAN_MODEL_ID=ft:gpt-4o-2024-07:greenlit:diagnostician-v1:abc123
```

No code deploy required to swap. The `llm-proxy` Edge Function reads these env vars and routes each intent to the correct model.

---

## Training data pipeline (v2.1 scaffolding)

The mechanic outcome-rating flow already exists in v2 (`src/lib/db/ratings.js`). v2.1 adds two hooks that make the collected data usable for training:

1. **Export endpoint** (`supabase/functions/export-training-data/`) — service-role authenticated. Returns JSONL where each row is a full intake with vehicle, conversation, media summary, final brief, and mechanic outcome. Only intakes with mechanic-confirmed outcomes are exported. This is the labeled training set.

2. **Annotation UI stub** (`src/pages/dev/AnnotationTool.jsx`) — auth-gated. Lets the cofounder (as a certified mechanic) view rated intakes and add per-message annotations of the form `{ best_next_question, reasoning }`. Persisted to a new `intake_annotations` table. This is Phase 2 of the data plan — cofounder's highest-leverage contribution is labeling, not raw data generation.

---

## Non-goals (explicit, to prevent scope creep)

- **No native iOS app in this PR.** Lock-screen shortcut is deferred; web-only for v2.1.
- **No fine-tune in this PR.** Model-swap seam is added; actual fine-tunes happen when data volume supports it (500+ labeled cases minimum).
- **No OBD-II integration in this PR.** Roadmap item for v3.
- **No EV-specific ontology in this PR.** Roadmap item for v4.
- **No redesign of the intake loop.** The v2 loop works; v2.1 formalizes and closes specific gaps only.

---

## References

- **Business plan amendment** (full strategic rationale): `docs/architecture-v2.1-business-context.md`
- **Cursor implementation task** (line-item changes to execute): `docs/architecture-v2.1-cursor-prompt.md`
- **v2 acceptance walkthrough** (regression baseline — must remain green after v2.1): `docs/pr-v2-body.md`
- **Original v2 implementation plan**: `docs/v2-implementation-plan.md`
