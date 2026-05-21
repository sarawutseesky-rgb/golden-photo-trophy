-- Recreate the daily-cap function with a clearer name/message
CREATE OR REPLACE FUNCTION public.enforce_daily_upload_cap()
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
  if cnt >= 1 then
    raise exception 'Upload limit reached: maximum 1 photo per day';
  end if;
  return new;
end;
$function$;

-- Attach trigger (drop first if exists, idempotent)
DROP TRIGGER IF EXISTS photos_enforce_daily_cap ON public.photos;
CREATE TRIGGER photos_enforce_daily_cap
BEFORE INSERT ON public.photos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_daily_upload_cap();

-- Also reattach the aggregate + notification triggers on votes/comments,
-- since the schema dump shows no triggers attached.
DROP TRIGGER IF EXISTS votes_recalc_aggregates ON public.votes;
CREATE TRIGGER votes_recalc_aggregates
AFTER INSERT OR UPDATE OR DELETE ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.recalc_photo_aggregates();

DROP TRIGGER IF EXISTS votes_notify ON public.votes;
CREATE TRIGGER votes_notify
AFTER INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_vote();

DROP TRIGGER IF EXISTS comments_notify ON public.comments;
CREATE TRIGGER comments_notify
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment();

-- Ensure new user trigger is attached on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();