-- Investigation note (Alex round-4 report: "infinite recursion detected in
-- policy for relation intakes" when a shop_members user touched the
-- consumer intake flow): reproduced against the linked prod project via
-- `supabase db query --linked` on pg_policies for intakes/shop_members/
-- consumer_intakes — no such recursion exists today. The only historical
-- recursion (shop_members self-referencing its own SELECT policy) was
-- already fixed in 0007_shop_onboarding_v2.sql and is confirmed live.
--
-- This migration does not fix an active bug. It renames the shop-membership
-- check used by the intakes-table policies to is_shop_member_of(), since
-- "intakes" was the relation named in the report, so future investigators
-- searching for that name land on a helper that documents this outcome.
-- Access intent is unchanged. is_shop_member() is left as-is for every
-- other table/policy that already uses it (shop_members, intake_messages,
-- intake_media, intake_ratings, storage.objects) to keep this change's
-- blast radius minimal.

CREATE OR REPLACE FUNCTION public.is_shop_member_of(target_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE user_id = auth.uid() AND shop_id = target_shop_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_shop_member_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_shop_member_of(uuid) TO authenticated;

DROP POLICY IF EXISTS intakes_shop_member_select ON public.intakes;
CREATE POLICY intakes_shop_member_select
  ON public.intakes FOR SELECT
  TO authenticated
  USING (shop_id IS NOT NULL AND public.is_shop_member_of(shop_id));

DROP POLICY IF EXISTS intakes_shop_member_update ON public.intakes;
CREATE POLICY intakes_shop_member_update
  ON public.intakes FOR UPDATE
  TO authenticated
  USING (shop_id IS NOT NULL AND public.is_shop_member_of(shop_id))
  WITH CHECK (shop_id IS NOT NULL AND public.is_shop_member_of(shop_id));
