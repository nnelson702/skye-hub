-- Department Walks V1
-- Store-specific walk questions, monthly walk execution, observations, and shared tasks.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, name)
);

create table if not exists public.department_walk_questions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  question_text text not null,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.department_walks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  walk_month date not null,
  status text not null default 'questions' check (status in ('questions', 'observations', 'completed')),
  started_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, department_id, walk_month)
);

create table if not exists public.department_walk_responses (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid not null references public.department_walks(id) on delete cascade,
  question_id uuid references public.department_walk_questions(id) on delete set null,
  question_text_snapshot text not null,
  result text not null check (result in ('standards_met', 'needs_attention', 'na')),
  notes text,
  answered_by uuid not null references auth.users(id) on delete restrict,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (walk_id, question_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to uuid references auth.users(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual', 'walk_question', 'observation')),
  source_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.department_walk_observations (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid references public.department_walks(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  event_type text not null,
  notes text,
  image_path text,
  logged_by uuid not null references auth.users(id) on delete restrict,
  logged_at timestamptz not null default now(),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_departments_store on public.departments(store_id, status, sort_order);
create index if not exists idx_walk_questions_store_department on public.department_walk_questions(store_id, department_id, status, sort_order);
create index if not exists idx_walks_store_month on public.department_walks(store_id, walk_month);
create index if not exists idx_walk_responses_walk on public.department_walk_responses(walk_id);
create index if not exists idx_tasks_store_status on public.tasks(store_id, status, created_at desc);
create index if not exists idx_observations_store on public.department_walk_observations(store_id, logged_at desc);

-- Keep access conservative. The authenticated app should never expose these tables to anon users.
alter table public.departments enable row level security;
alter table public.department_walk_questions enable row level security;
alter table public.department_walks enable row level security;
alter table public.department_walk_responses enable row level security;
alter table public.tasks enable row level security;
alter table public.department_walk_observations enable row level security;

-- Reusable store access rule based on the existing user profile and store-access model.
create or replace function public.user_can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (
        p.role = 'Admin'
        or p.home_store_id = target_store_id
        or exists (
          select 1
          from public.user_store_access usa
          where usa.user_id = auth.uid()
            and usa.store_id = target_store_id
        )
      )
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.status = 'active' and p.role = 'Admin'
  );
$$;

grant execute on function public.user_can_access_store(uuid) to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

create policy "departments_select_store_access" on public.departments
for select to authenticated using (public.user_can_access_store(store_id));
create policy "departments_admin_write" on public.departments
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "walk_questions_select_store_access" on public.department_walk_questions
for select to authenticated using (public.user_can_access_store(store_id));
create policy "walk_questions_admin_write" on public.department_walk_questions
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "walks_store_access" on public.department_walks
for all to authenticated using (public.user_can_access_store(store_id)) with check (public.user_can_access_store(store_id));

create policy "walk_responses_store_access" on public.department_walk_responses
for all to authenticated
using (exists (select 1 from public.department_walks w where w.id = walk_id and public.user_can_access_store(w.store_id)))
with check (exists (select 1 from public.department_walks w where w.id = walk_id and public.user_can_access_store(w.store_id)));

create policy "tasks_store_access" on public.tasks
for all to authenticated using (public.user_can_access_store(store_id)) with check (public.user_can_access_store(store_id));

create policy "walk_observations_store_access" on public.department_walk_observations
for all to authenticated using (public.user_can_access_store(store_id)) with check (public.user_can_access_store(store_id));

comment on column public.department_walk_responses.question_text_snapshot is
  'Immutable wording captured when answered so later question edits do not rewrite historical walks.';
