-- Subscription tier scaffolding + consumer intake debug tool (no enforcement yet)
-- Run against staging first, then production.

-- ---------------------------------------------------------------------------
-- Schema: forward-compat subscription tier column (nullable during beta)
-- ---------------------------------------------------------------------------

ALTER TABLE public.consumer_profiles
  ADD COLUMN subscription_tier text
    CHECK (subscription_tier IS NULL OR subscription_tier IN ('free', 'premium', 'beta_lifetime'));

CREATE INDEX consumer_profiles_subscription_tier_idx
  ON public.consumer_profiles (subscription_tier) WHERE subscription_tier IS NOT NULL;

COMMENT ON COLUMN public.consumer_profiles.subscription_tier IS
  'Nullable during beta. Populated when paywall lands.';

-- ---------------------------------------------------------------------------
-- Debug: list consumer intakes (runs as definer; caller must be allowlisted)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.debug_list_consumer_intakes()
RETURNS SETOF public.consumer_intakes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL OR v_email NOT IN (
    'yashbolishetti@gmail.com',
    'apexhermes13@gmail.com',
    'bhp5ve@virginia.edu'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.consumer_intakes ORDER BY created_at DESC LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.debug_list_consumer_intakes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_list_consumer_intakes() TO authenticated;
