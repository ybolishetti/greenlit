-- Re-assert the anonymous intake insert policy in case it drifted.
DROP POLICY IF EXISTS intakes_anon_insert ON public.intakes;

CREATE POLICY intakes_anon_insert
  ON public.intakes
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'in_progress'
    AND brief IS NULL
    AND urgency IS NULL
    AND category IS NULL
    AND flagged IS NOT TRUE
    AND archived_at IS NULL
  );

-- Also make sure the anon role can SELECT its just-inserted row back
-- (the .select().single() after .insert() requires SELECT to return the row).
DROP POLICY IF EXISTS intakes_anon_select_own_recent ON public.intakes;

CREATE POLICY intakes_anon_select_own_recent
  ON public.intakes
  FOR SELECT
  TO anon
  USING (
    created_at > now() - interval '10 minutes'
    AND brief IS NULL
  );

-- Belt-and-suspenders: ensure status has the correct default in prod.
ALTER TABLE public.intakes ALTER COLUMN status SET DEFAULT 'in_progress';
