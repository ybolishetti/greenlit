-- Real LLM-powered diagnosis engine (Anthropic swap): per-intake cost
-- tracking, low-confidence flagging, and stub-fallback tracking on intakes,
-- plus a placeholder rules-baseline column on llm_traces for a future
-- offline eval job (not populated by this migration or by any Edge
-- Function code in this PR — the rules engine, src/lib/mockDiagnosis.js,
-- runs in Node/Vite and can't execute inside the Deno Edge Function
-- without a real port + a conversation-to-legacy-shape adapter).

BEGIN;

ALTER TABLE intakes
  ADD COLUMN IF NOT EXISTS llm_cost_usd    numeric(10, 4),
  ADD COLUMN IF NOT EXISTS llm_cost_capped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_confidence  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_used   boolean NOT NULL DEFAULT false;

ALTER TABLE llm_traces
  ADD COLUMN IF NOT EXISTS rules_baseline jsonb;

COMMENT ON COLUMN intakes.llm_cost_usd IS
  'Cumulative LLM cost for this intake in USD, computed from llm_traces.input_tokens/output_tokens. Updated by llm-proxy when the final brief is persisted or the cost cap is hit.';
COMMENT ON COLUMN intakes.llm_cost_capped IS
  'TRUE if the $0.45/intake cost cap was hit and the remainder of the intake ran on stub.';
COMMENT ON COLUMN intakes.low_confidence IS
  'TRUE if the final Diagnostician confidence is < 0.60 (raw, before the per-cause display cap at 55). Surfaced on the shop dashboard.';
COMMENT ON COLUMN intakes.fallback_used IS
  'TRUE if any round fell back to the deterministic stub (LLM error, cost cap, or DIAGNOSIS_ENGINE=stub). Set client-side, persisted via the diagnostician_final/stub_brief Edge Function path (the only write path into intakes for stub-mode briefs).';
COMMENT ON COLUMN llm_traces.rules_baseline IS
  'Deterministic mockDiagnosis.js output for offline eval, as a sanity-check baseline against the real LLM output. NULL until a future backfill job populates it — not computed in the Edge Function.';

COMMIT;
