-- Feed records: keep normal authenticated access, but restrict deletes to Admin.
-- Run this in Supabase SQL Editor after the feed tables exist.

alter table public."FeedsConsumption" enable row level security;
alter table public."FeedReceived" enable row level security;
alter table public."FeedTransferIn" enable row level security;
alter table public."FeedTransferOut" enable row level security;

drop policy if exists "Authenticated users can read feed consumption" on public."FeedsConsumption";
drop policy if exists "Authenticated users can insert feed consumption" on public."FeedsConsumption";
drop policy if exists "Authenticated users can update feed consumption" on public."FeedsConsumption";
drop policy if exists "Only admins can delete feed consumption" on public."FeedsConsumption";

create policy "Authenticated users can read feed consumption"
on public."FeedsConsumption"
for select
to authenticated
using (true);

create policy "Authenticated users can insert feed consumption"
on public."FeedsConsumption"
for insert
to authenticated
with check (true);

create policy "Authenticated users can update feed consumption"
on public."FeedsConsumption"
for update
to authenticated
using (true)
with check (true);

create policy "Only admins can delete feed consumption"
on public."FeedsConsumption"
for delete
to authenticated
using (
  exists (
    select 1
    from public."Users" users
    where users.user_uuid = auth.uid()
      and users.role = 'Admin'
      and coalesce(users.status, 'Active') <> 'Inactive'
  )
);

drop policy if exists "Authenticated users can read feed received" on public."FeedReceived";
drop policy if exists "Authenticated users can insert feed received" on public."FeedReceived";
drop policy if exists "Authenticated users can update feed received" on public."FeedReceived";
drop policy if exists "Only admins can delete feed received" on public."FeedReceived";

create policy "Authenticated users can read feed received"
on public."FeedReceived"
for select
to authenticated
using (true);

create policy "Authenticated users can insert feed received"
on public."FeedReceived"
for insert
to authenticated
with check (true);

create policy "Authenticated users can update feed received"
on public."FeedReceived"
for update
to authenticated
using (true)
with check (true);

create policy "Only admins can delete feed received"
on public."FeedReceived"
for delete
to authenticated
using (
  exists (
    select 1
    from public."Users" users
    where users.user_uuid = auth.uid()
      and users.role = 'Admin'
      and coalesce(users.status, 'Active') <> 'Inactive'
  )
);

drop policy if exists "Authenticated users can read feed transfer in" on public."FeedTransferIn";
drop policy if exists "Authenticated users can insert feed transfer in" on public."FeedTransferIn";
drop policy if exists "Authenticated users can update feed transfer in" on public."FeedTransferIn";
drop policy if exists "Only admins can delete feed transfer in" on public."FeedTransferIn";

create policy "Authenticated users can read feed transfer in"
on public."FeedTransferIn"
for select
to authenticated
using (true);

create policy "Authenticated users can insert feed transfer in"
on public."FeedTransferIn"
for insert
to authenticated
with check (true);

create policy "Authenticated users can update feed transfer in"
on public."FeedTransferIn"
for update
to authenticated
using (true)
with check (true);

create policy "Only admins can delete feed transfer in"
on public."FeedTransferIn"
for delete
to authenticated
using (
  exists (
    select 1
    from public."Users" users
    where users.user_uuid = auth.uid()
      and users.role = 'Admin'
      and coalesce(users.status, 'Active') <> 'Inactive'
  )
);

drop policy if exists "Authenticated users can read feed transfer out" on public."FeedTransferOut";
drop policy if exists "Authenticated users can insert feed transfer out" on public."FeedTransferOut";
drop policy if exists "Authenticated users can update feed transfer out" on public."FeedTransferOut";
drop policy if exists "Only admins can delete feed transfer out" on public."FeedTransferOut";

create policy "Authenticated users can read feed transfer out"
on public."FeedTransferOut"
for select
to authenticated
using (true);

create policy "Authenticated users can insert feed transfer out"
on public."FeedTransferOut"
for insert
to authenticated
with check (true);

create policy "Authenticated users can update feed transfer out"
on public."FeedTransferOut"
for update
to authenticated
using (true)
with check (true);

create policy "Only admins can delete feed transfer out"
on public."FeedTransferOut"
for delete
to authenticated
using (
  exists (
    select 1
    from public."Users" users
    where users.user_uuid = auth.uid()
      and users.role = 'Admin'
      and coalesce(users.status, 'Active') <> 'Inactive'
  )
);
