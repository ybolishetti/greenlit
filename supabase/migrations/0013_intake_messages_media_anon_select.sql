-- 0011 fixed the anon SELECT-after-INSERT gap for `intakes` (the
-- .select().single() after .insert() requires SELECT to return the row) but
-- missed the same gap on `intake_messages` and `intake_media` — both are
-- written via the identical .insert().select().single() pattern on every
-- anonymous intake submission (appendMessage / uploadMedia), so anonymous
-- submissions were still failing with a 42501 RLS violation on the very
-- first appendMessage call right after intake creation.

CREATE POLICY intake_messages_anon_select_recent
  ON public.intake_messages
  FOR SELECT
  TO anon
  USING (intake_created_within_30_minutes(intake_id));

CREATE POLICY intake_media_anon_select_recent
  ON public.intake_media
  FOR SELECT
  TO anon
  USING (intake_created_within_30_minutes(intake_id));
