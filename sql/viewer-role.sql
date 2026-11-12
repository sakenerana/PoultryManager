-- Run once (safe to rerun) in the poultry project's Supabase SQL Editor as postgres.
-- Deploy this before assigning any account the Viewer role.
-- Uses the default table names; adjust the table manifest if VITE_* table overrides are used.
begin;

-- Support deployments with either an enum or a text/check constraint for Users.role.
do $$
declare
  role_type record;
  role_column smallint;
  constraint_row record;
begin
  select t.typtype, n.nspname, t.typname, a.attnum
    into role_type
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where a.attrelid = 'public."Users"'::regclass and a.attname = 'role' and not a.attisdropped;

  if not found then raise exception 'Users.role is required'; end if;
  role_column := role_type.attnum;
  if role_type.typtype = 'e' then
    execute format('alter type %I.%I add value if not exists %L', role_type.nspname, role_type.typname, 'Viewer');
  end if;

  -- Only replace role-only allow-list checks; preserve checks involving other columns.
  for constraint_row in
    select conname from pg_constraint
    where conrelid = 'public."Users"'::regclass and contype = 'c'
      and conkey = array[role_column]::smallint[]
      and pg_get_constraintdef(oid) like '%Admin%'
      and pg_get_constraintdef(oid) like '%Staff%'
  loop
    execute format('alter table public."Users" drop constraint %I', constraint_row.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."Users"'::regclass and conname = 'users_supported_app_role'
  ) then
    alter table public."Users" add constraint users_supported_app_role
      check (role::text in ('Admin', 'Supervisor', 'Staff', 'Viewer'));
  end if;
end;
$$;

create or replace function public.current_app_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select case when coalesce(profile.status::text, 'Active') <> 'Inactive' then profile.role::text end
  from public."Users" profile
  where profile.user_uuid = auth.uid()
  order by profile.created_at desc, profile.id desc
  limit 1;
$$;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- Statement triggers also cover SECURITY DEFINER RPCs that bypass row-level security.
create or replace function public.enforce_viewer_read_only()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if coalesce(public.current_app_role(), '') not in ('Admin', 'Supervisor', 'Staff') then
      raise exception 'This account has read-only access. Creating, editing and deleting records is not allowed.'
        using errcode = '42501';
    end if;
  elsif current_setting('role', true) in ('anon', 'authenticated') then
    raise exception 'An active account with write access is required.' using errcode = '42501';
  end if;
  return null;
end;
$$;
revoke all on function public.enforce_viewer_read_only() from public, anon, authenticated;

do $$
declare
  table_name text;
  relation_kind "char";
  existing_policy record;
  viewer_read_expression text;
begin
  foreach table_name in array array[
    'Users', 'Buildings', 'Subbuildings', 'Grows', 'Load', 'LoadTransactions',
    'GrowLogs', 'GrowReductionTransactions', 'BodyWeightLogs',
    'DOATransactions', 'CulledTransactions', 'TransferTransactions',
    'Harvest', 'HarvestTrucks', 'HarvestLogs', 'HarvestReductionTransactions',
    'FeedsConsumption', 'FeedReceived', 'FeedTransferIn', 'FeedTransferOut',
    'FeedUsageSummary', 'ElectricityConsumption', 'IncomeSummary'
  ] loop
    if to_regclass(format('public.%I', table_name)) is null then continue; end if;

    select relkind into relation_kind from pg_class
      where oid = to_regclass(format('public.%I', table_name));
    -- FeedUsageSummary can be a report view in existing deployments.
    if relation_kind in ('v', 'm') then
      execute format('grant select on public.%I to authenticated', table_name);
      if relation_kind = 'v' then
        execute format('drop trigger if exists enforce_viewer_read_only on public.%I', table_name);
        execute format(
          'create trigger enforce_viewer_read_only before insert or update or delete on public.%I for each statement execute function public.enforce_viewer_read_only()', table_name
        );
      end if;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('drop trigger if exists enforce_viewer_read_only on public.%I', table_name);
    execute format(
      'create trigger enforce_viewer_read_only before insert or update or delete or truncate on public.%I for each statement execute function public.enforce_viewer_read_only()',
      table_name
    );

    -- RESTRICTIVE policies combine with existing policies using AND, so broad
    -- authenticated write policies cannot grant writes to Viewers.
    execute format('drop policy if exists viewer_no_insert on public.%I', table_name);
    execute format('create policy viewer_no_insert on public.%I as restrictive for insert to authenticated with check ((select public.current_app_role()) in (''Admin'', ''Supervisor'', ''Staff''))', table_name);
    execute format('drop policy if exists viewer_no_update on public.%I', table_name);
    execute format('create policy viewer_no_update on public.%I as restrictive for update to authenticated using ((select public.current_app_role()) in (''Admin'', ''Supervisor'', ''Staff'')) with check ((select public.current_app_role()) in (''Admin'', ''Supervisor'', ''Staff''))', table_name);
    execute format('drop policy if exists viewer_no_delete on public.%I', table_name);
    execute format('create policy viewer_no_delete on public.%I as restrictive for delete to authenticated using ((select public.current_app_role()) in (''Admin'', ''Supervisor'', ''Staff''))', table_name);

    viewer_read_expression := case when table_name = 'Users'
      then '(select public.current_app_role()) = ''Viewer'' and user_uuid = auth.uid()'
      else '(select public.current_app_role()) = ''Viewer''' end;

    -- Accommodate existing restrictive read policies without changing writer access.
    if table_name <> 'IncomeSummary' then
      for existing_policy in
        select polname, pg_get_expr(polqual, polrelid) as expression
        from pg_policy
        where polrelid = to_regclass(format('public.%I', table_name))
          and not polpermissive and polcmd in ('r', '*')
          and polname not in ('viewer_profile_scope', 'viewer_no_financial_reads')
      loop
        if coalesce(existing_policy.expression, '') not like '%current_app_role%' then
          execute format('alter policy %I on public.%I using ((%s) or (%s))',
            existing_policy.polname, table_name, coalesce(existing_policy.expression, 'true'), viewer_read_expression);
        end if;
      end loop;

      execute format('drop policy if exists viewer_read on public.%I', table_name);
      execute format('create policy viewer_read on public.%I for select to authenticated using (%s)', table_name, viewer_read_expression);
    end if;
  end loop;
end;
$$;

-- A Viewer can read their own profile for access checks, never the account list.
drop policy if exists viewer_profile_scope on public."Users";
create policy viewer_profile_scope on public."Users" as restrictive for select to authenticated
using ((select public.current_app_role()) is distinct from 'Viewer' or user_uuid = auth.uid());

-- Preserve the existing Admin-only income-report boundary.
do $$
begin
  if to_regclass('public."IncomeSummary"') is not null then
    drop policy if exists viewer_no_financial_reads on public."IncomeSummary";
    create policy viewer_no_financial_reads on public."IncomeSummary" as restrictive for select to authenticated
      using ((select public.current_app_role()) is distinct from 'Viewer');
  end if;
end;
$$;

commit;
