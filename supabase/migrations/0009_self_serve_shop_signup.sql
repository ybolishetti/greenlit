-- Self-serve shop signup: any signed-in user can create a shop and become
-- its owner immediately, on a free pilot plan, flagged for admin review.

-- ---------------------------------------------------------------------------
-- shops — signup source/status tracking. Existing rows default to
-- signup_source = 'admin', signup_status = 'active', created_by = NULL.
-- ---------------------------------------------------------------------------

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS signup_source text NOT NULL DEFAULT 'admin'
    CHECK (signup_source IN ('admin', 'self_serve')),
  ADD COLUMN IF NOT EXISTS signup_status text NOT NULL DEFAULT 'active'
    CHECK (signup_status IN ('active', 'pending_review', 'suspended')),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- create_shop_self_serve — self-serve signup RPC. SECURITY DEFINER: the
-- caller isn't a shop member yet, so this must bypass RLS to insert both the
-- shops row and the owner's shop_members row in one transaction.
-- Rate-limited to 1 shop per user per 24h to prevent abuse.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_shop_self_serve(
  p_name text,
  p_slug text,
  p_contact_email text,
  p_timezone text DEFAULT 'America/New_York'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop_id uuid;
  v_recent_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate limit: 1 shop per user per 24 hours
  SELECT count(*) INTO v_recent_count
  FROM public.shops
  WHERE created_by = v_uid
    AND created_at > now() - interval '24 hours';

  IF v_recent_count >= 1 THEN
    RAISE EXCEPTION 'You can only create one shop per 24 hours. Contact hello@greenlit.co for help.';
  END IF;

  -- Validate slug format (alphanumeric + hyphens, 3-40 chars)
  IF p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Slug must be 3-40 chars, lowercase letters/numbers/hyphens only';
  END IF;

  IF p_slug IN ('admin', 'api', 'shop', 'intake', 'account', 'auth', 'dev', 'for-shops', 'test', 'www') THEN
    RAISE EXCEPTION 'That slug is reserved';
  END IF;

  IF EXISTS (SELECT 1 FROM public.shops WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug is already taken';
  END IF;

  INSERT INTO public.shops (name, slug, plan, contact_email, timezone, signup_source, signup_status, created_by)
  VALUES (p_name, p_slug, 'pilot', p_contact_email, p_timezone, 'self_serve', 'pending_review', v_uid)
  RETURNING id INTO v_shop_id;

  INSERT INTO public.shop_members (shop_id, user_id, role)
  VALUES (v_shop_id, v_uid, 'owner');

  RETURN v_shop_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_shop_self_serve(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_shop_self_serve(text, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- is_shop_slug_available — live availability check for the signup form.
-- Reserved-slug list intentionally duplicated from create_shop_self_serve
-- above — keep both in sync if a slug is added/removed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_shop_slug_available(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.shops WHERE slug = p_slug
  ) AND p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
    AND p_slug NOT IN ('admin', 'api', 'shop', 'intake', 'account', 'auth', 'dev', 'for-shops', 'test', 'www');
$$;

GRANT EXECUTE ON FUNCTION public.is_shop_slug_available(text) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- list_shops_admin — admin-panel shop list with creator email. auth.users
-- isn't exposed to PostgREST directly, so this follows the same pattern as
-- list_shop_members_with_email (0005_shop_facing.sql): a SECURITY DEFINER
-- function that joins auth.users and gates on is_admin() itself.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_shops_admin()
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  plan text,
  address text,
  contact_email text,
  contact_phone text,
  timezone text,
  signup_source text,
  signup_status text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.slug, s.name, s.plan, s.address, s.contact_email, s.contact_phone,
         s.timezone, s.signup_source, s.signup_status, s.created_by, u.email, s.created_at
  FROM public.shops s
  LEFT JOIN auth.users u ON u.id = s.created_by
  WHERE public.is_admin();
$$;

REVOKE EXECUTE ON FUNCTION public.list_shops_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_shops_admin() TO authenticated;
