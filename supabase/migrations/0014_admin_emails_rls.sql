-- admin_emails had RLS disabled entirely: any anon-key holder could read or
-- write the admin allowlist (found via `supabase db advisors` during the
-- Alex round-4 investigation — unrelated to Alex's reported issues, fixed
-- here as hygiene since it's a real privilege-escalation hole).

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_emails_admin_all
  ON public.admin_emails FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
