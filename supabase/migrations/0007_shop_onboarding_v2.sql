-- Shop onboarding v2: fix recursive shop_members RLS policy, add
-- email-based pre-provisioning (pending_shop_members + claim RPC).

-- ---------------------------------------------------------------------------
-- shop_members_select_same_shop (0001) self-queries shop_members inside its
-- own USING clause -> "infinite recursion detected in policy for relation
-- shop_members" on any query that hits the table directly. is_shop_member()
-- is SECURITY DEFINER and already used everywhere else for this exact
-- purpose; is_admin() (0005) covers admin-panel access. Neither recurses.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS shop_members_select_same_shop ON public.shop_members;

CREATE POLICY shop_members_select_same_shop
  ON public.shop_members FOR SELECT
  TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());

-- ---------------------------------------------------------------------------
-- pending_shop_members — admin/owner invites a shop member by email before
-- they've ever signed in. Claimed into shop_members on sign-in via
-- claim_pending_shop_memberships() below.
-- ---------------------------------------------------------------------------

CREATE TABLE public.pending_shop_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  email            text NOT NULL,
  role             text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  claimed_at       timestamptz,
  claimed_user_id  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  UNIQUE (shop_id, email)
);

-- Case-insensitive uniqueness while unclaimed (the UNIQUE above is
-- case-sensitive and would let "Foo@x.com" and "foo@x.com" both sit pending).
CREATE UNIQUE INDEX pending_shop_members_unclaimed_email_idx
  ON public.pending_shop_members (shop_id, lower(email))
  WHERE claimed_at IS NULL;

ALTER TABLE public.pending_shop_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_shop_members_admin_all
  ON public.pending_shop_members FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY pending_shop_members_owner_all
  ON public.pending_shop_members FOR ALL
  TO authenticated
  USING (public.is_shop_owner(shop_id))
  WITH CHECK (public.is_shop_owner(shop_id));

-- ---------------------------------------------------------------------------
-- claim_pending_shop_memberships — called on sign-in. Resolves any pending
-- invite matching the signed-in user's email into a real shop_members row.
-- SECURITY DEFINER: the invitee is neither a shop owner nor an admin, so this
-- must bypass RLS on both pending_shop_members and shop_members to claim
-- their own row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_pending_shop_memberships()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_count integer := 0;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  WITH claimed AS (
    UPDATE public.pending_shop_members
    SET claimed_at = now(), claimed_user_id = auth.uid()
    WHERE claimed_at IS NULL
      AND lower(email) = lower(v_email)
    RETURNING shop_id, role
  ), inserted AS (
    INSERT INTO public.shop_members (shop_id, user_id, role)
    SELECT shop_id, auth.uid(), role FROM claimed
    ON CONFLICT (shop_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_pending_shop_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_shop_memberships() TO authenticated;
