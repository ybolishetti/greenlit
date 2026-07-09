-- Shop dashboard v2: moderation columns on the existing operational `intakes`
-- table, plus admin RLS passthrough (was previously missing).

ALTER TABLE intakes
  ADD COLUMN flagged        boolean NOT NULL DEFAULT false,
  ADD COLUMN flagged_reason text,
  ADD COLUMN flagged_at     timestamptz,
  ADD COLUMN archived_at    timestamptz;

CREATE INDEX intakes_shop_id_created_at_idx
  ON intakes (shop_id, created_at DESC)
  WHERE shop_id IS NOT NULL;

-- intakes_shop_member_select/update (0001) only ever checked is_shop_member();
-- an admin (per is_admin(), 0005) who isn't a real shop_members row would get
-- empty data from listShopIntakes()/saveRating() despite passing the
-- dashboard's client-side route guard. Mirrors shops_admin_all /
-- shop_members_admin_all from 0005_shop_facing.sql.
CREATE POLICY intakes_admin_all
  ON intakes FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY intake_ratings_admin_all
  ON intake_ratings FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
