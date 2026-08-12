-- Private image storage for Department Walk observations.
insert into storage.buckets (id, name, public)
values ('walk-images', 'walk-images', false)
on conflict (id) do update set public = false;

create policy "walk_images_select_store_access"
on storage.objects for select to authenticated
using (
  bucket_id = 'walk-images'
  and public.user_can_access_store(((storage.foldername(name))[1])::uuid)
);

create policy "walk_images_insert_store_access"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'walk-images'
  and public.user_can_access_store(((storage.foldername(name))[1])::uuid)
);

create policy "walk_images_update_store_access"
on storage.objects for update to authenticated
using (
  bucket_id = 'walk-images'
  and public.user_can_access_store(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'walk-images'
  and public.user_can_access_store(((storage.foldername(name))[1])::uuid)
);

create policy "walk_images_delete_store_access"
on storage.objects for delete to authenticated
using (
  bucket_id = 'walk-images'
  and public.user_can_access_store(((storage.foldername(name))[1])::uuid)
);
