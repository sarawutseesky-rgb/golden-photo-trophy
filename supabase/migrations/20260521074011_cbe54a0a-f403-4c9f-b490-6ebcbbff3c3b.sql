
-- Drop duplicate trigger
DROP TRIGGER IF EXISTS photos_monthly_cap ON public.photos;

-- Recreate cap function with 3/day and friendlier message
CREATE OR REPLACE FUNCTION public.enforce_daily_upload_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  cnt int;
  daily_limit int := 3;
begin
  select count(*) into cnt
  from public.photos
  where user_id = new.user_id
    and created_at >= (now() at time zone 'utc')::date;
  if cnt >= daily_limit then
    raise exception 'คุณอัปโหลดครบ % รูปสำหรับวันนี้แล้ว พรุ่งนี้ค่อยมาอัปต่อนะ', daily_limit;
  end if;
  return new;
end;
$$;
