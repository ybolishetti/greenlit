-- Shop-facing beta: marketing leads, shop billing/contact columns, admin allowlist + RLS
-- Run against staging first, then production.

-- ---------------------------------------------------------------------------
-- shop_leads — inbound sales inquiries from /for-shops contact form.
-- ---------------------------------------------------------------------------

CREATE TABLE public.shop_leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name         text NOT NULL,
  contact_name      text NOT NULL,
  contact_email     text NOT NULL,
  contact_phone     text,
  location          text,
  bays              int,
  monthly_intakes   text,          -- bucket: '<50', '50-150', '150-400', '400+'
  notes             text,
  source            text,          -- utm_source or 'landing_page'
  status            text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'contacted', 'pilot', 'active', 'churned', 'rejected')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  contacted_at      timestamptz,
  converted_shop_id uuid REFERENCES public.shops (id) ON DELETE SET NULL
);

CREATE INDEX shop_leads_status_created_at_idx
  ON public.shop_leads (status, created_at DESC);

ALTER TABLE public.shop_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_leads_public_insert
  ON public.shop_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- shops — add billing/plan columns (unenforced during beta)
-- ---------------------------------------------------------------------------

ALTER TABLE public.shops
  ADD COLUMN plan text
    CHECK (plan IS NULL OR plan IN ('pilot', 'standard', 'growth', 'high_volume')),
  ADD COLUMN plan_started_at timestamptz,
  ADD COLUMN included_intakes int,
  ADD COLUMN contact_email text,
  ADD COLUMN contact_phone text,
  ADD COLUMN address text,
  ADD COLUMN timezone text DEFAULT 'America/New_York';

COMMENT ON COLUMN public.shops.plan IS
  'Nullable during beta. Populated when shop is provisioned.';

-- ---------------------------------------------------------------------------
-- Admin allowlist + RLS
-- ---------------------------------------------------------------------------

CREATE TABLE public.admin_emails (
  email text PRIMARY KEY,
  added_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_emails (email) VALUES ('yashbolishetti@gmail.com');

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_emails
    WHERE email = (SELECT auth.jwt() ->> 'email')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE POLICY shop_leads_admin_all
  ON public.shop_leads FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Existing policies on shops: shops_anon_select / shops_authenticated_select
-- (both SELECT-only, USING true). Existing policies on shop_members:
-- shop_members_select_same_shop (SELECT-only). Neither table has write
-- policies yet, so the admin ALL policies below are additive.
CREATE POLICY shops_admin_all
  ON public.shops FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY shop_members_admin_all
  ON public.shop_members FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Shop owners can remove members of their own shop (Team tab, task 5).
-- shop_members has no owner-facing write policy yet — this is additive.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_shop_owner(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shop_members sm
    WHERE sm.shop_id = p_shop_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'owner'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_shop_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid) TO authenticated;

CREATE POLICY shop_members_owner_delete
  ON public.shop_members FOR DELETE
  TO authenticated
  USING (public.is_shop_owner(shop_id));

-- ---------------------------------------------------------------------------
-- Team tab needs member emails, which live in auth.users (not exposed to
-- PostgREST). This definer RPC lets a shop member (or admin) read their own
-- shop's roster with emails attached.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_shop_members_with_email(p_shop_id uuid)
RETURNS TABLE (shop_id uuid, user_id uuid, role text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.shop_id, sm.user_id, sm.role, u.email
  FROM public.shop_members sm
  JOIN auth.users u ON u.id = sm.user_id
  WHERE sm.shop_id = p_shop_id
    AND (public.is_shop_member(p_shop_id) OR public.is_admin());
$$;

REVOKE EXECUTE ON FUNCTION public.list_shop_members_with_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_shop_members_with_email(uuid) TO authenticated;
