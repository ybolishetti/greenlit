-- ============================================================================
-- Migration 0012: saved_vehicles
-- Lets signed-in consumers save multiple vehicles to their profile so they
-- don't have to re-enter year/make/model/mileage on every intake.
-- ============================================================================

CREATE TABLE public.saved_vehicles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.consumer_profiles(id) ON DELETE CASCADE,
  year         int NOT NULL CHECK (year >= 1980 AND year <= extract(year from now())::int + 1),
  make         text NOT NULL,
  model        text NOT NULL,
  mileage      int CHECK (mileage IS NULL OR mileage >= 0),
  nickname     text,
  is_default   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_vehicles_user_id_idx ON public.saved_vehicles(user_id);

-- Only one default per user
CREATE UNIQUE INDEX saved_vehicles_one_default_per_user_idx
  ON public.saved_vehicles(user_id) WHERE is_default = true;

ALTER TABLE public.saved_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_vehicles_owner_select ON public.saved_vehicles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY saved_vehicles_owner_insert ON public.saved_vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_vehicles_owner_update ON public.saved_vehicles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_vehicles_owner_delete ON public.saved_vehicles
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_saved_vehicles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_vehicles_updated_at
  BEFORE UPDATE ON public.saved_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_saved_vehicles_updated_at();
