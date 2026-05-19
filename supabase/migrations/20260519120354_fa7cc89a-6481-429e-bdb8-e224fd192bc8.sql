CREATE OR REPLACE FUNCTION public.enforce_monthly_upload_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  cnt int;
begin
  select count(*) into cnt
  from public.photos
  where user_id = new.user_id
    and created_at >= (now() at time zone 'utc')::date;
  if cnt >= 5 then
    raise exception 'Upload limit reached: maximum 5 photos per day';
  end if;
  return new;
end;
$function$;