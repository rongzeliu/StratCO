-- =========================================================
-- StratCode: initial schema + RLS
-- =========================================================

-- ---------- profiles ----------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          text not null default 'solver' check (role in ('solver', 'founder')),
  display_name  text,
  created_at    timestamptz not null default now()
);

-- ---------- challenges ----------
create table public.challenges (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  brief_md          text not null,
  csv_url           text,
  stage2_questions  jsonb not null default '[]'::jsonb,
  rubric_structure  jsonb,
  rubric_memo       jsonb,
  baseline          jsonb,
  created_at        timestamptz not null default now()
);

-- ---------- challenge_answers (secret-key only) ----------
create table public.challenge_answers (
  challenge_id  uuid primary key references public.challenges (id) on delete cascade,
  answers       jsonb not null
);

-- ---------- submissions ----------
create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  challenge_id    uuid not null references public.challenges (id) on delete cascade,
  stage1          jsonb,
  stage2          jsonb,
  stage3          text,
  scores          jsonb,
  feedback        jsonb,
  baseline_delta  numeric,
  status          text not null default 'draft'
                  check (status in ('draft', 'submitted', 'grading', 'graded')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, challenge_id)
);
create index submissions_challenge_id_idx on public.submissions (challenge_id);

-- ---------- vouches ----------
create table public.vouches (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  founder_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  outcome_note   text,
  created_at     timestamptz not null default now(),
  unique (submission_id, founder_id)
);

-- =========================================================
-- Helper: role check (SECURITY DEFINER so it isn't blocked by profiles RLS)
-- =========================================================
create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'founder'
  );
$$;
revoke execute on function public.is_founder() from public, anon;
grant  execute on function public.is_founder() to authenticated;

-- =========================================================
-- Enable RLS on every table
-- =========================================================
alter table public.profiles          enable row level security;
alter table public.challenges        enable row level security;
alter table public.challenge_answers enable row level security;
alter table public.submissions       enable row level security;
alter table public.vouches           enable row level security;

-- =========================================================
-- Policies
-- =========================================================

-- profiles
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- challenges
create policy "challenges_select_authenticated"
  on public.challenges for select to authenticated
  using (true);

-- challenge_answers: intentionally NO policies.

-- submissions
create policy "submissions_select_own"
  on public.submissions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "submissions_insert_own"
  on public.submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'draft');

create policy "submissions_update_own_draft"
  on public.submissions for update to authenticated
  using      (user_id = (select auth.uid()) and status = 'draft')
  with check (user_id = (select auth.uid()) and status = 'draft');

create policy "submissions_select_founder"
  on public.submissions for select to authenticated
  using ((select public.is_founder()));

-- vouches
create policy "vouches_insert_founder"
  on public.vouches for insert to authenticated
  with check (founder_id = (select auth.uid()) and (select public.is_founder()));

-- =========================================================
-- Column-level privileges (extra protection on top of RLS)
-- =========================================================

-- challenge_answers: no table privileges for client roles at all
revoke all on public.challenge_answers from anon, authenticated;

-- Clients cannot write profiles (prevents changing your own role to founder)
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Solvers can only write their own stage content; scores/feedback/status are server-only
revoke insert, update, delete on public.submissions from anon, authenticated;
grant insert (user_id, challenge_id, stage1, stage2, stage3) on public.submissions to authenticated;
grant update (stage1, stage2, stage3)                         on public.submissions to authenticated;

-- Vouches: insert only
revoke update, delete on public.vouches from anon, authenticated;

-- 1. Create a profile on signup. Role is never taken from signup metadata
--    (that field is user-controlled). New users are always 'solver'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Hide baseline and rubrics from clients (column-level select)
revoke select on public.challenges from anon, authenticated;
grant select (id, title, brief_md, csv_url, stage2_questions, created_at)
  on public.challenges to authenticated;

-- 3. Vouch visibility: the voucher, or the solver who was vouched for
create policy "vouches_select_involved"
  on public.vouches for select to authenticated
  using (
    founder_id = (select auth.uid())
    or exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.user_id = (select auth.uid())
    )
  );

-- Founders see only graded submissions
drop policy "submissions_select_founder" on public.submissions;
create policy "submissions_select_founder"
  on public.submissions for select to authenticated
  using (status = 'graded' and (select public.is_founder()));

-- Founders can vouch only for submissions they can see (i.e. graded)
drop policy "vouches_insert_founder" on public.vouches;
create policy "vouches_insert_founder"
  on public.vouches for insert to authenticated
  with check (
    founder_id = (select auth.uid())
    and (select public.is_founder())
    and exists (select 1 from public.submissions s where s.id = submission_id)
  );
