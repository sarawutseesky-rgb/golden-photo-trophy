CREATE TABLE public.photo_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL,
  viewer_key text NOT NULL,
  time_bucket bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, viewer_key, time_bucket)
);

CREATE INDEX idx_photo_view_events_photo ON public.photo_view_events(photo_id);
CREATE INDEX idx_photo_view_events_created ON public.photo_view_events(created_at);

ALTER TABLE public.photo_view_events ENABLE ROW LEVEL SECURITY;

-- No public policies: only service role (supabaseAdmin) can read/write.