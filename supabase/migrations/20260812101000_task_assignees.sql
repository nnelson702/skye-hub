-- Return only active users eligible to receive work for a store.
create or replace function public.store_task_assignees(target_store_id uuid)
returns table (
  id uuid,
  full_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email
  from public.user_profiles p
  where public.user_can_access_store(target_store_id)
    and p.status = 'active'
    and (
      p.role = 'Admin'
      or p.home_store_id = target_store_id
      or exists (
        select 1
        from public.user_store_access usa
        where usa.user_id = p.id
          and usa.store_id = target_store_id
      )
    )
  order by p.full_name nulls last, p.email;
$$;

grant execute on function public.store_task_assignees(uuid) to authenticated;
