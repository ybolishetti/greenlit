-- Consumer auth + intake persistence (separate from shop-side intakes)
-- Run against staging first, then production.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.consumer_profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email        text,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.consumer_intakes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  device_id    text,
  vehicle      jsonb NOT NULL,
  inputs       jsonb NOT NULL,
  brief        jsonb,
  status       text NOT NULL DEFAULT 'in_progress'
               CHECK (status IN ('in_progress', 'complete', 'claimed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  claimed_at   timestamptz
);

CREATE INDEX consumer_intakes_user_id_idx ON public.consumer_intakes (user_id);
CREATE INDEX consumer_intakes_device_id_idx ON public.consumer_intakes (device_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.consumer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own profile" ON public.consumer_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users update own profile" ON public.consumer_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users insert own profile" ON public.consumer_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users read own intakes" ON public.consumer_intakes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own intakes" ON public.consumer_intakes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "anonymous insert intakes" ON public.consumer_intakes
  FOR INSERT WITH CHECK (user_id IS NULL AND device_id IS NOT NULL);

CREATE POLICY "users update own intakes" ON public.consumer_intakes
  FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Claim anonymous intake (runs as definer; caller must be authenticated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_anonymous_intake(p_device_id text, p_intake_id uuid)
RETURNS public.consumer_intakes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_row     public.consumer_intakes;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.consumer_intakes
  SET
    user_id    = v_user_id,
    status     = 'claimed',
    claimed_at = now()
  WHERE id = p_intake_id
    AND device_id = p_device_id
    AND user_id IS NULL
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Intake not found or already claimed';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_anonymous_intake(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_intake(text, uuid) TO authenticated;
