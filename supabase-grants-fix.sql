-- Run this after creating the cars table, especially if "Automatically expose new tables" was disabled.
-- It gives Supabase API roles permission to use the public schema, cars table, and car-images storage bucket.

grant usage on schema public to anon, authenticated;
grant select on public.cars to anon, authenticated;
grant insert, update, delete on public.cars to authenticated;

grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

drop policy if exists "Authenticated admin can read all cars" on public.cars;
create policy "Authenticated admin can read all cars"
on public.cars
for select
to authenticated
using (true);
