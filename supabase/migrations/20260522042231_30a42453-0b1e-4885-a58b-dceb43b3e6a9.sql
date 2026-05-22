CREATE TABLE public.install_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  platform TEXT,
  standalone BOOLEAN NOT NULL DEFAULT false,
  user_id UUID,
  session_id TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_install_events_event ON public.install_events(event);
CREATE INDEX idx_install_events_created_at ON public.install_events(created_at DESC);

ALTER TABLE public.install_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert install events"
ON public.install_events
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read install events"
ON public.install_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));