-- Break the intakes ⇄ intake_ratings RLS policy cycle that caused
-- ERROR 42P17 "infinite recursion detected in policy for relation intakes"
-- for shop_members trying to SELECT from public.intakes.
--
-- Root cause: intakes.intakes_annotator_select_rated selected from
-- intake_ratings, and intake_ratings.intake_ratings_shop_member_select
-- selected from intakes. Both are RLS-enabled → Postgres has to enforce
-- policy A to satisfy policy B and vice versa → cycle.
--
-- Fix pattern: replace both cross-table lookups with SECURITY DEFINER
-- helpers that bypass RLS on the peer table. Preserves access intent
-- exactly. Also replaces the annotator EXISTS subquery with an explicit
-- helper so the peer-table read never re-enters intakes RLS.

-- Helper 1: does intake_id have any rating? Used by the annotator policy on intakes.
CREATE OR REPLACE FUNCTION public.intake_has_rating(p_intake_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.intake_ratings r WHERE r.intake_id = p_intake_id);
$$;

REVOKE EXECUTE ON FUNCTION public.intake_has_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intake_has_rating(uuid) TO authenticated;

-- Helper 2: is caller a shop member of the shop that owns intake_id?
-- Used by the shop-member policies on intake_ratings.
CREATE OR REPLACE FUNCTION public.is_shop_member_of_intake(p_intake_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.intakes i
    JOIN public.shop_members sm ON sm.shop_id = i.shop_id
    WHERE i.id = p_intake_id
      AND i.shop_id IS NOT NULL
      AND sm.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_shop_member_of_intake(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_shop_member_of_intake(uuid) TO authenticated;

-- Rewrite intakes.intakes_annotator_select_rated using the helper.
DROP POLICY IF EXISTS intakes_annotator_select_rated ON public.intakes;
CREATE POLICY intakes_annotator_select_rated
  ON public.intakes FOR SELECT
  TO authenticated
  USING (public.is_annotator_or_admin() AND public.intake_has_rating(id));

-- Rewrite intake_ratings shop-member policies using the helper.
DROP POLICY IF EXISTS intake_ratings_shop_member_select ON public.intake_ratings;
CREATE POLICY intake_ratings_shop_member_select
  ON public.intake_ratings FOR SELECT
  TO authenticated
  USING (public.is_shop_member_of_intake(intake_id));

DROP POLICY IF EXISTS intake_ratings_shop_member_update ON public.intake_ratings;
CREATE POLICY intake_ratings_shop_member_update
  ON public.intake_ratings FOR UPDATE
  TO authenticated
  USING (public.is_shop_member_of_intake(intake_id))
  WITH CHECK (public.is_shop_member_of_intake(intake_id));

-- Rewrite insert WITH CHECK (exists in 0001) to use the same helper,
-- preserving rated_by = auth.uid() intent.
DROP POLICY IF EXISTS intake_ratings_shop_member_insert ON public.intake_ratings;
CREATE POLICY intake_ratings_shop_member_insert
  ON public.intake_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    rated_by = auth.uid()
    AND public.is_shop_member_of_intake(intake_id)
  );
