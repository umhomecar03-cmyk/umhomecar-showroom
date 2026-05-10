-- ให้บัญชีที่ล็อกอินแล้วอ่านรถทุกสถานะได้ รวมถึงสถานะ hidden
-- วางใน Supabase SQL Editor แล้วกด Run

drop policy if exists "Authenticated admin can read all cars" on public.cars;

create policy "Authenticated admin can read all cars"
on public.cars
for select
 to authenticated
using (true);
