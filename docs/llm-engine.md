# LLM diagnosis engine

Architecture reference for the Interviewer/Diagnostician round loop that powers the guided intake. For the exact provider/model wiring and deploy steps, see `supabase/README.md` → "Edge Function: `llm-proxy`".

## Two-model architecture

- **Interviewer** (`claude-haiku-4-5` by default) picks the next question(s) and a `question_intent` per question. It never chooses UI components.
- **Diagnostician** (`claude-sonnet-5` by default) produces a running `hypothesis` (confidence + gaps + top causes) once per round, and the final mechanic brief at the end.
- **`uiRules.js`** deterministically maps every `question_intent` to a concrete UI component (single/multi-select, slider, toggle, media request, freeform text). The LLM only ever emits an intent string — it never picks or influences the rendered UI element.

This split means a model can be swapped, retried, or fall back to a stub without changing how questions render.

## Round loop

```
 answers submitted
        │
        ▼
 Diagnostician (once per round cycle, not per question)
        │
        ▼
 hypothesis { confidence, needs_more_info[], top_causes? }
        │
        ▼
 shouldForceDone(messages)?  ── round ≥ 3, OR confidence ≥ 0.90,
        │                       OR total questions asked ≥ 8
   yes ─┤
        ▼
 name step ──▶ diagnostician_final (streamed) ──▶ mechanic brief
        │
   no ──┘
        ▼
 Interviewer(last_hypothesis, force_done) ──▶ question_batch | done
        │
        ▼
 enrichQuestionBatch (uiRules.js) ──▶ rendered question UI
```

The Diagnostician firing cadence (once per submitted batch, never per individual question) is intentional — see the comment in `src/pages/intake/IntakeSession.jsx` above `runDiagnosticianRound`. Do not restructure it into per-question calls.

## Turn limits (`src/lib/intake/turnLimits.js`)

| Constant | Value | Meaning |
|---|---|---|
| `MAX_ROUNDS` | 3 | Hard ceiling on interview rounds |
| `MAX_QUESTIONS_PER_ROUND` | 3 | Max questions per single batch |
| `MAX_QUESTIONS` | 8 | Total questions across all rounds (below the 3×3=9 theoretical max) |
| `CONFIDENCE_FORCE_DONE` | 0.90 | Diagnostician confidence at which the interview stops early |

`shouldForceDone()` combines all three; `IntakeSession.jsx` checks it after every round and skips straight to the name step + final brief once it's true.

## Question-intent vocabulary and UI mapping

18 intents total, each mapped 1:1 to a UI component in `INTENT_UI_MAP` (`src/lib/intake/uiRules.js`): the original 14 (symptom timing/location/duration/frequency, pedal/steering feel, vibration intensity/location, warning lights, visible damage, sound/motion capture, safety confirmation, freeform description) plus four mechanic-native additions — `smell_description`, `driving_conditions`, `recent_repairs`, `fluid_check` — all rendered as structured multi-selects.

`sound_capture`/`motion_capture` are only ever askable during the initial intake capture (before round 1). The Edge Function strips any bare occurrence of these two intents from a Diagnostician's `needs_more_info` once the interview is underway — audio/video can't be re-requested mid-interview, only photos (`visible_damage`) and text.

## Custom probes

The Diagnostician can steer the Interviewer's phrasing without touching the deterministic UI mapping, by writing a `needs_more_info` entry as `"<intent>:<probe text>"` instead of a plain gap description — e.g. `"visible_damage:need a close-up of the driver-side CV boot"`.

- The Edge Function passes `needs_more_info` through to the Interviewer **unfiltered** — it doesn't parse or validate the probe format.
- The Interviewer prompt reads the text after the colon as a phrasing hint, writes a natural question around it, and echoes only the **base intent** back in `question_intent`. A colon-suffixed value in the Interviewer's own output fails schema validation.
- `parseIntent()` in `uiRules.js` splits `"<intent>:<probe>"` on the first colon (so probe text containing a colon, e.g. a time like "3:00", isn't mis-split) and normalizes to the base intent before attaching UI. This is defense-in-depth — in the normal flow, a suffixed intent never reaches this function, since schema validation on the Interviewer's raw output rejects it first.
- The raw probe text is never shown to the customer and never persisted on the stored question — only the base intent is.

## Safety, cost, and fallback

- **Safety-urgency validator** (Edge Function, deterministic, not prompt-trusted): scans the conversation for hard safety patterns (active brake/steering failure, fire/smoke, overheating, airbag/SRS warning) and force-overrides `urgency` to `immediate` when matched, regardless of what the model returned. Logged to `llm_traces.parse_error` as `safety_override:<reason>`.
- **Cost cap**: $0.45/intake, computed from `llm_traces.input_tokens`/`output_tokens` summed by model. A capped call returns `cost_cap_exceeded`, which the client treats like any other LLM failure — see below.
- **Low confidence**: when the Diagnostician's overall confidence is `< 0.60`, per-cause confidences are clamped to 55 in the persisted brief, and `intakes.low_confidence` is set for the low-confidence banner and shop-dashboard badge.
- **Kill switch / fallback**: `DIAGNOSIS_ENGINE=stub` on the Edge Function (or `VITE_LLM_STUB_MODE=true`/missing Supabase config client-side) makes every LLM call return `llm_unconfigured`. The client (`src/lib/ai/client.js`) treats `edge_error`, `llm_unconfigured`, and `cost_cap_exceeded` identically — fall through to the deterministic `mockDiagnosis.js`-backed stub, and (for the final brief) persist with `fallback_used: true` so the fallback banner and badge render.
