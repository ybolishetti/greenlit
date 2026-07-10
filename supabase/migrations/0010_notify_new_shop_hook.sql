-- Notify Yash + Alex by email whenever a new self-serve shop is created, so
-- they have a real-time signal to reach out and qualify the shop within 24h
-- (there's no Stripe yet — monetization is manual during pilot).
--
-- This is a backup path: ShopSignup.jsx already fires the notify_new_shop
-- edge function directly after create_shop_self_serve() returns. This
-- trigger covers shops created via any non-client path (admin panel,
-- direct SQL, future API). Send-twice for the normal client path is
-- acceptable for pilot — see docs/shop-facing.md.
--
-- Requires the pg_net extension for async HTTP calls (enabled by default on Supabase).
-- Note: pg_net is fire-and-forget — the DB commit doesn't wait for the HTTP response.
-- If pg_net or the edge function fails, the shop still gets created. That's the
-- intended behavior — signup must never block on notification delivery.

-- ---------------------------------------------------------------------------
-- ONE-TIME MANUAL SETUP (Yash must run these with real values BEFORE the
-- trigger fires):
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://drgvgulfppttyvrvjlxr.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service-role-key-from-supabase-dashboard>';
--
-- These are stored at the database level (not in migrations for security).
-- Get service role key from: Project Settings → API → service_role secret
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_new_shop_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url', true);
  v_service_role_key text := current_setting('app.service_role_key', true);
BEGIN
  -- Only fire for self-serve shops
  IF NEW.signup_source != 'self_serve' THEN
    RETURN NEW;
  END IF;

  -- If the one-time manual setup hasn't been run yet, skip rather than error
  -- out the insert — the client-side call in ShopSignup.jsx still covers it.
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget async HTTP call to the edge function
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/notify_new_shop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('shop_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_shop_notify
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_shop_trigger();
