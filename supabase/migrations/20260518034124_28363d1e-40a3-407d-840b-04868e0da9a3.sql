
-- =========================================================================
-- ENUMS
-- =========================================================================
create type public.app_role as enum ('admin', 'user');

-- =========================================================================
-- PROFILES
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'StarShooter',
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- USER ROLES
-- =========================================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "user_roles_select_own_or_admin" on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "user_roles_admin_manage" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- PHOTOS
-- =========================================================================
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  image_url text not null,
  storage_path text not null,
  width int,
  height int,
  avg_score numeric(3,2) not null default 0,
  vote_count int not null default 0,
  current_rank int,
  rank_one_since timestamptz,
  milestone_stars int not null default 0,
  milestone_achieved_at timestamptz[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint photos_milestone_range check (milestone_stars between 0 and 5),
  constraint photos_status_valid check (status in ('active','removed'))
);

create index photos_created_at_idx on public.photos (created_at desc);
create index photos_ranking_idx on public.photos (avg_score desc, vote_count desc) where vote_count >= 10 and status = 'active';
create index photos_user_idx on public.photos (user_id);

alter table public.photos enable row level security;

create policy "photos_select_active_or_owner_or_admin" on public.photos for select
  using (status = 'active' or auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "photos_insert_own" on public.photos for insert
  with check (auth.uid() = user_id);
create policy "photos_update_own_or_admin" on public.photos for update
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "photos_delete_own_or_admin" on public.photos for delete
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Monthly upload cap (3 per calendar month UTC)
create or replace function public.enforce_monthly_upload_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cnt int;
begin
  select count(*) into cnt
  from public.photos
  where user_id = new.user_id
    and created_at >= date_trunc('month', now() at time zone 'utc');
  if cnt >= 3 then
    raise exception 'Upload limit reached: maximum 3 photos per month';
  end if;
  return new;
end;
$$;

create trigger photos_monthly_cap
  before insert on public.photos
  for each row execute function public.enforce_monthly_upload_cap();

-- =========================================================================
-- VOTES
-- =========================================================================
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  voted_at timestamptz not null default now(),
  unique (photo_id, voter_id),
  constraint votes_score_range check (score between 1 and 5)
);

create index votes_photo_idx on public.votes (photo_id);
create index votes_voted_at_idx on public.votes (voted_at desc);

alter table public.votes enable row level security;

create policy "votes_select_all" on public.votes for select using (true);
create policy "votes_insert_own_not_self" on public.votes for insert
  with check (
    auth.uid() = voter_id
    and voter_id <> (select user_id from public.photos where id = photo_id)
  );

-- Recalc photo aggregates on vote insert/update/delete
create or replace function public.recalc_photo_aggregates()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  pid := coalesce(new.photo_id, old.photo_id);
  update public.photos
  set
    avg_score = coalesce((select round(avg(score)::numeric, 2) from public.votes where photo_id = pid), 0),
    vote_count = (select count(*) from public.votes where photo_id = pid)
  where id = pid;
  return coalesce(new, old);
end;
$$;

create trigger votes_recalc
  after insert or update or delete on public.votes
  for each row execute function public.recalc_photo_aggregates();

-- =========================================================================
-- COMMENTS
-- =========================================================================
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index comments_photo_idx on public.comments (photo_id, created_at desc);

alter table public.comments enable row level security;

create policy "comments_select_all" on public.comments for select using (true);
create policy "comments_insert_own" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_update_own" on public.comments for update using (auth.uid() = user_id);
create policy "comments_delete_own_or_admin" on public.comments for delete
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  photo_id uuid references public.photos(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);

-- Notify owner on new vote
create or replace function public.notify_on_vote()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  voter_name text;
begin
  select user_id into owner_id from public.photos where id = new.photo_id;
  if owner_id is null or owner_id = new.voter_id then
    return new;
  end if;
  select display_name into voter_name from public.profiles where id = new.voter_id;
  insert into public.notifications (user_id, type, photo_id, message)
  values (owner_id, 'vote', new.photo_id, coalesce(voter_name, 'Someone') || ' rated your photo ' || new.score || '★');
  return new;
end;
$$;

create trigger votes_notify
  after insert on public.votes
  for each row execute function public.notify_on_vote();

-- Notify owner on new comment
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  commenter_name text;
begin
  select user_id into owner_id from public.photos where id = new.photo_id;
  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;
  select display_name into commenter_name from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, type, photo_id, message)
  values (owner_id, 'comment', new.photo_id, coalesce(commenter_name, 'Someone') || ' commented on your photo');
  return new;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- =========================================================================
-- REPORTS
-- =========================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint reports_status_valid check (status in ('pending','resolved','dismissed'))
);

alter table public.reports enable row level security;

create policy "reports_insert_authed" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_admin_select" on public.reports for select using (public.has_role(auth.uid(), 'admin'));
create policy "reports_admin_update" on public.reports for update using (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- STORAGE BUCKET
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos_storage_read_all" on storage.objects for select using (bucket_id = 'photos');
create policy "photos_storage_insert_own" on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "photos_storage_update_own" on storage.objects for update
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "photos_storage_delete_own" on storage.objects for delete
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================================================
-- REALTIME
-- =========================================================================
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.photos;
alter publication supabase_realtime add table public.notifications;
