-- Greenlit v2.1: vehicle context, training annotations, annotator roles

-- ---------------------------------------------------------------------------
-- Vehicle context on intakes
-- ---------------------------------------------------------------------------

ALTER TABLE intakes ADD COLUMN IF NOT EXISTS vehicle jsonb;
-- vehicle: { year: int, make: text, model: text, mileage: int | null, trim: text | null }

-- ---------------------------------------------------------------------------
-- Annotator / admin roles (for training-data labeling UI)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role    text NOT NULL CHECK (role IN ('admin', 'annotator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION is_annotator_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'annotator')
  );
$$;

-- ---------------------------------------------------------------------------
-- Per-message training annotations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS intake_annotations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id    uuid NOT NULL REFERENCES intakes (id) ON DELETE CASCADE,
  message_id   uuid NOT NULL REFERENCES intake_messages (id) ON DELETE CASCADE,
  annotation   jsonb NOT NULL,
  annotated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intake_annotations_shape CHECK (
    annotation ? 'best_next_question'
    AND annotation ? 'reasoning'
  )
);

CREATE INDEX IF NOT EXISTS intake_annotations_intake_id_idx
  ON intake_annotations (intake_id);

CREATE INDEX IF NOT EXISTS intake_annotations_message_id_idx
  ON intake_annotations (message_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_self_select
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY intake_annotations_annotator_select
  ON intake_annotations FOR SELECT
  TO authenticated
  USING (is_annotator_or_admin());

CREATE POLICY intake_annotations_annotator_insert
  ON intake_annotations FOR INSERT
  TO authenticated
  WITH CHECK (
    annotated_by = auth.uid()
    AND is_annotator_or_admin()
  );

CREATE POLICY intake_annotations_annotator_update
  ON intake_annotations FOR UPDATE
  TO authenticated
  USING (is_annotator_or_admin())
  WITH CHECK (
    annotated_by = auth.uid()
    AND is_annotator_or_admin()
  );

CREATE POLICY intake_annotations_annotator_delete
  ON intake_annotations FOR DELETE
  TO authenticated
  USING (is_annotator_or_admin());

-- Annotators may read rated intakes and their messages for labeling
CREATE POLICY intakes_annotator_select_rated
  ON intakes FOR SELECT
  TO authenticated
  USING (
    is_annotator_or_admin()
    AND EXISTS (SELECT 1 FROM intake_ratings r WHERE r.intake_id = id)
  );

CREATE POLICY intake_messages_annotator_select
  ON intake_messages FOR SELECT
  TO authenticated
  USING (
    is_annotator_or_admin()
    AND EXISTS (SELECT 1 FROM intake_ratings r WHERE r.intake_id = intake_id)
  );

CREATE POLICY intake_ratings_annotator_select
  ON intake_ratings FOR SELECT
  TO authenticated
  USING (is_annotator_or_admin());

-- Seed demo annotator (replace email as needed)
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'admin'
FROM auth.users u
WHERE u.email = 'yashbolishetti@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
