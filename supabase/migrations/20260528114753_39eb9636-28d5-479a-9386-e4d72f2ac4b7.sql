
-- 1) Prevent privilege escalation on user_roles: only admins may INSERT
DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;

CREATE POLICY user_roles_admin_insert
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY user_roles_admin_update
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY user_roles_admin_delete
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Restrict votes SELECT (was public). Server reads use service_role (bypasses RLS).
DROP POLICY IF EXISTS votes_select_all ON public.votes;

CREATE POLICY votes_select_own
  ON public.votes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = voter_id);

-- 3) photo_view_events: add admin-only SELECT so RLS isn't enabled without policy.
CREATE POLICY photo_view_events_admin_select
  ON public.photo_view_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Lock down SECURITY DEFINER helper functions: only server (service_role) may execute.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_photo_view(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_photo_view(uuid) TO service_role;
