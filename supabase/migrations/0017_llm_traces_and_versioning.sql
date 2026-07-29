-- Data flywheel: persist full LLM interaction traces (separate from
-- llm_call_log, which stays a lightweight rate-limit counter), stamp
-- prompt/model/build versions onto intakes at creation time, and add a
-- numeric accuracy score + comment to intake_ratings, additive to the
-- existing on_target categorical field.

CREATE TABLE llm_traces (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id       uuid NOT NULL REFERENCES intakes (id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('interviewer', 'diagnostician')),
  round_number    integer,
  model_id        text NOT NULL,
  prompt_version  text NOT NULL,
  prompt_input    jsonb NOT NULL,
  response_raw    jsonb,
  response_parsed jsonb,
  parse_error     text,
  latency_ms      integer,
  input_tokens    integer,
  output_tokens   integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX llm_traces_intake_id_created_at_idx ON llm_traces (intake_id, created_at);
CREATE INDEX llm_traces_role_created_at_idx ON llm_traces (role, created_at);
CREATE INDEX llm_traces_prompt_version_idx ON llm_traces (prompt_version);

ALTER TABLE llm_traces ENABLE ROW LEVEL SECURITY;

-- Only the service role (Edge Function) writes to llm_traces — no client
-- INSERT/UPDATE/DELETE policy, mirroring llm_call_log's service-role-only
-- precedent for writes.

-- Shop members can read traces for their own intakes (future annotation
-- surface). Reuses is_shop_member_of_intake() from 0016 rather than adding
-- a fourth near-duplicate "is shop member" helper.
CREATE POLICY llm_traces_shop_member_select
  ON llm_traces FOR SELECT
  TO authenticated
  USING (public.is_shop_member_of_intake(intake_id));

-- Annotators/admins can read traces once an intake has been rated, matching
-- the same privacy invariant intakes_annotator_select_rated (0016) applies
-- to the intakes table itself.
CREATE POLICY llm_traces_annotator_select
  ON llm_traces FOR SELECT
  TO authenticated
  USING (public.is_annotator_or_admin() AND public.intake_has_rating(intake_id));

-- Prompt/model/build provenance, stamped once at intake creation.
ALTER TABLE intakes
  ADD COLUMN interviewer_prompt_version   text,
  ADD COLUMN diagnostician_prompt_version text,
  ADD COLUMN interviewer_model_id         text,
  ADD COLUMN diagnostician_model_id       text,
  ADD COLUMN ui_rules_version             text,
  ADD COLUMN app_build_sha                text;

-- Numeric accuracy signal + open comment, additive to on_target.
ALTER TABLE intake_ratings
  ADD COLUMN accuracy_score integer CHECK (accuracy_score IS NULL OR accuracy_score BETWEEN 0 AND 100),
  ADD COLUMN comment        text;
