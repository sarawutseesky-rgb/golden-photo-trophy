# StarShot — Build Plan

A photo community where members upload photos, others vote 1–5, and photos earn up to 5 permanent "milestone stars" based on how long they hold the #1 ranked position.

## Tech & Infrastructure

- **Frontend**: TanStack Start (React 19 + TS) + Tailwind v4 + shadcn/ui
- **Backend**: Lovable Cloud (Postgres + Auth + Storage + scheduled jobs)
- **Server logic**: `createServerFn` for app-internal calls; `/api/public/cron` route for the scheduled ranking job
- **Realtime**: Supabase Realtime channel for live vote/score updates on photo detail
- **Image processing**: client-side compress/resize to ≤1200px width before upload (browser canvas)

## Auth

- Email + password (Lovable Cloud default). Google sign-in optional — ask before adding.
- `profiles` table auto-created via trigger on `auth.users` insert
- `user_roles` table + `has_role()` SECURITY DEFINER for admin gating (never store role on profile)
- Protected routes under `src/routes/_authenticated/` (upload, notifications, profile/me)
- Admin routes under `src/routes/_authenticated/_admin/`

## Database Schema (migrations)

```text
profiles(id PK→auth.users, display_name, avatar_url, bio, created_at)

app_role enum: 'admin' | 'user'
user_roles(id, user_id, role, UNIQUE(user_id, role))

photos(
  id, user_id→profiles, title, description, tags text[],
  image_url, storage_path, width, height,
  avg_score numeric, vote_count int,
  current_rank int, rank_one_since timestamptz,
  milestone_stars int CHECK 0..5,
  milestone_achieved_at timestamptz[],
  status text default 'active',   -- 'active' | 'removed'
  created_at
)

votes(id, photo_id, voter_id, score int CHECK 1..5, voted_at,
      UNIQUE(photo_id, voter_id))

comments(id, photo_id, user_id, content, created_at)

notifications(id, user_id, type, photo_id, message, read bool, created_at)

reports(id, photo_id, reporter_id, reason, status, created_at)
```

Indexes: `votes(photo_id)`, `photos(avg_score DESC, vote_count DESC) WHERE vote_count >= 10`, `notifications(user_id, read)`.

### RLS (essential policies)
- `photos`: SELECT public where status='active'; INSERT self; UPDATE/DELETE self or admin
- `votes`: SELECT public; INSERT self AND `voter_id != photos.user_id`; UPDATE own; no duplicates via UNIQUE
- `comments`: SELECT public; INSERT/UPDATE/DELETE self (or admin delete)
- `notifications`: SELECT/UPDATE own only
- `reports`: INSERT self; SELECT admin only
- Monthly upload cap enforced in a trigger on `photos` insert (count user's photos in current calendar month, reject if ≥3)

### Storage
- Bucket `photos` (public read). RLS: insert path must start with `auth.uid()/`.

## Star Milestone Logic

Thresholds: 1d, 7d, 30d, 90d, 180d held continuously at #1 (min 10 votes to qualify for ranking).

**Cron job** (every 5 min) — `/api/public/cron/rank` protected by `CRON_SECRET` header:
1. Recompute `avg_score`, `vote_count` for photos with new votes (or do via DB trigger on `votes`)
2. Find current #1: `SELECT * FROM photos WHERE vote_count>=10 AND status='active' ORDER BY avg_score DESC, vote_count DESC LIMIT 1`
3. If different from previous #1 holder:
   - Old holder: set `rank_one_since = NULL`
   - New holder: set `rank_one_since = now()` (only if currently NULL)
4. For the current #1: compute elapsed since `rank_one_since`; for each threshold passed where `milestone_stars < N`, increment `milestone_stars`, append timestamp to `milestone_achieved_at`, create notification
5. Update `current_rank` for top N photos (top 100)

Stars are permanent — never decremented. Losing #1 only nulls `rank_one_since`.

Triggers also handle: insert into `votes` → recompute that photo's `avg_score`/`vote_count`; create "someone voted" notification (throttled). Insert into `comments` → notification to photo owner.

## Server Functions (`src/lib/*.functions.ts`)

- `uploadPhoto` (auth) — validates monthly cap, inserts row, returns signed upload URL
- `castVote` (auth) — upsert vote with self-vote and duplicate guards
- `getPhoto`, `listFeed`, `listTopRated`, `listHallOfFame`, `listTrending` (public; use admin client with scoped WHERE)
- `addComment`, `reportPhoto`, `markNotificationsRead` (auth)
- `adminListReports`, `adminRemovePhoto` (auth + admin role check)

Public route loaders call only public server fns (per TanStack rules).

## Routes (file-based, each with own `head()` meta)

```text
src/routes/
  __root.tsx                       (shell + nav + auth listener + Realtime invalidation)
  index.tsx                        /        Newest feed
  top.tsx                          /top
  hall-of-fame.tsx                 /hall-of-fame
  trending.tsx                     /trending
  photo.$id.tsx                    /photo/:id
  profile.$id.tsx                  /profile/:id
  login.tsx                        /login
  signup.tsx                       /signup
  _authenticated.tsx               (gate)
  _authenticated/upload.tsx        /upload
  _authenticated/notifications.tsx /notifications
  _authenticated/profile.me.tsx    /profile/me
  _authenticated/_admin.tsx        (role gate)
  _authenticated/_admin/admin.tsx  /admin
  api/public/cron/rank.ts          POST cron endpoint
```

## UI / Design

- Dark navy `#0F172A` background, gold `#F59E0B` accents, Inter font
- Masonry photo grid; star badges (filled gold / outline gray) overlaid on card corner with subtle glow animation on newly earned
- Photo detail: large image, 5-star selector, average + distribution bar chart, milestone progress bar to next star
- Mobile-first responsive; skeleton loaders; friendly empty states
- All colors via `src/styles.css` oklch tokens — no hex in components

## Build Order

1. Enable Lovable Cloud; migrations for all tables, enums, RLS, triggers, storage bucket
2. Auth pages (`/login`, `/signup`) + `_authenticated` gate + root auth listener
3. Photo upload (client compression, monthly cap UI, storage upload)
4. Home feed + photo card component
5. Photo detail + voting widget + comments + distribution chart
6. Realtime subscription for live vote updates
7. Cron endpoint + ranking/milestone logic + DB triggers; verify with `invoke-server-function`
8. Leaderboard tabs (Top / Hall of Fame / Trending) + search/tag filter
9. Profile page + trophy case
10. Notifications center + bell badge
11. Admin dashboard (reports, remove photos, disable users)
12. Polish: animations on new star, skeletons, empty states, SEO meta per route

## Open Questions

1. **Google sign-in** in addition to email/password? (Cloud supports it natively)
2. **Cron scheduling** — use Lovable Cloud `pg_cron` calling the `/api/public/cron/rank` endpoint with a secret header — OK?
3. **Vote changes** — can a user change their existing vote, or is it locked once cast?
4. **Monthly upload cap reset** — calendar month (1st of month UTC) or rolling 30 days?
5. **Self-voting** — confirmed disallowed; should uploader still see the voting UI as disabled, or hidden entirely?
