CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name text;
  resolved_avatar text;
begin
  resolved_name := coalesce(
    nullif(meta->>'display_name', ''),
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'StarShooter'
  );
  resolved_avatar := coalesce(
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'picture', '')
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, resolved_name, resolved_avatar)
  on conflict (id) do update
    set
      display_name = case
        when public.profiles.display_name is null
          or public.profiles.display_name = ''
          or public.profiles.display_name = 'StarShooter'
        then excluded.display_name
        else public.profiles.display_name
      end,
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();