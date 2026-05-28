DROP POLICY IF EXISTS "Anyone can insert install events" ON public.install_events;

CREATE POLICY "Anyone can insert valid install events"
ON public.install_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event IN (
    'prompt_shown',
    'prompt_shown_ios',
    'install_clicked',
    'install_accepted',
    'install_dismissed',
    'app_installed'
  )
  AND (platform IS NULL OR length(platform) <= 64)
  AND (user_agent IS NULL OR length(user_agent) <= 512)
  AND (session_id IS NULL OR length(session_id) <= 128)
);