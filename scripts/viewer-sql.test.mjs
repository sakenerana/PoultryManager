import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Install the isolated test engine without adding an application dependency:
// npm install --prefix node_modules/.viewer-validation --no-save --package-lock=false @electric-sql/pglite
const { PGlite } = await import('../node_modules/.viewer-validation/node_modules/@electric-sql/pglite/dist/index.js');
const migration = await readFile(new URL('../sql/viewer-role.sql', import.meta.url), 'utf8');
const ids = {
  Admin: '00000000-0000-4000-8000-000000000001',
  Supervisor: '00000000-0000-4000-8000-000000000002',
  Staff: '00000000-0000-4000-8000-000000000003',
  Viewer: '00000000-0000-4000-8000-000000000004',
  Inactive: '00000000-0000-4000-8000-000000000005',
};

async function createDatabase(enumRole = false) {
  const db = new PGlite();
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    ${enumRole ? "create type public.app_role as enum ('Admin','Supervisor','Staff');" : ''}
    create table public."Users" (
      id bigint generated always as identity primary key,
      user_uuid uuid not null,
      role ${enumRole ? 'public.app_role' : "text check (role in ('Admin','Supervisor','Staff'))"},
      status text default 'Active',
      created_at timestamptz default now()
    );
    create table public."Grows" (id bigint primary key, mortality integer default 0);
    create table public."IncomeSummary" (id bigint primary key);
    create view public."FeedUsageSummary" as select * from public."Grows";
    insert into public."Grows" values (1, 10);
    insert into public."IncomeSummary" values (1);
    grant all on public."Users", public."Grows", public."IncomeSummary", public."FeedUsageSummary" to authenticated;
    grant usage on all sequences in schema public to authenticated;
    alter table public."Users" enable row level security;
    alter table public."Grows" enable row level security;
    alter table public."IncomeSummary" enable row level security;
    create policy broad_legacy_access on public."Users" for all to authenticated using (true) with check (true);
    create policy broad_legacy_access on public."Grows" for all to authenticated using (true) with check (true);
    create policy broad_legacy_access on public."IncomeSummary" for all to authenticated using (true) with check (true);
    create policy old_restrictive_reads on public."Grows" as restrictive for select to authenticated using (auth.uid() <> '${ids.Viewer}'::uuid);
    create function public.legacy_write_rpc() returns void language sql security definer set search_path = '' as
      $$ update public."Grows" set mortality = mortality + 1 where id = 1 $$;
    grant execute on function public.legacy_write_rpc() to authenticated;
  `);
  for (const role of ['Admin', 'Supervisor', 'Staff']) {
    await db.query('insert into public."Users" (user_uuid,role) values ($1,$2)', [ids[role], role]);
  }
  await db.exec(migration);
  await db.query('insert into public."Users" (user_uuid,role) values ($1,$2)', [ids.Viewer, 'Viewer']);
  await db.query('insert into public."Users" (user_uuid,role,status) values ($1,$2,$3)', [ids.Inactive, 'Viewer', 'Inactive']);
  return db;
}

async function asUser(db, role, action) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${ids[role]}';`);
  try { return await action(); }
  finally { await db.exec("reset role; reset request.jwt.claim.sub;"); }
}

for (const enumRole of [false, true]) {
  test(`migration works and is repeatable with ${enumRole ? 'enum' : 'text/check'} roles`, async () => {
    const db = await createDatabase(enumRole);
    try {
      await db.exec(migration);
      await asUser(db, 'Viewer', async () => {
        assert.equal((await db.query('select * from public."Grows"')).rows.length, 1);
        assert.equal((await db.query('select * from public."FeedUsageSummary"')).rows.length, 1);
        const profiles = (await db.query('select * from public."Users"')).rows;
        assert.equal(profiles.length, 1);
        assert.equal(profiles[0].user_uuid, ids.Viewer);
        assert.equal((await db.query('select * from public."IncomeSummary"')).rows.length, 0);
        for (const sql of [
          'insert into public."Grows" values (2,0)',
          'update public."Grows" set mortality=99 where id=1',
          'delete from public."Grows" where id=1',
          'update public."FeedUsageSummary" set mortality=99 where id=1',
          `update public."Users" set role='Admin' where user_uuid='${ids.Viewer}'`,
          'select public.legacy_write_rpc()',
          'truncate public."Grows"',
        ]) {
          await assert.rejects(db.exec(sql), (error) => error.code === '42501', sql);
        }
      });
      for (const role of ['Admin', 'Supervisor', 'Staff']) {
        await asUser(db, role, async () => {
          await db.exec('insert into public."Grows" values (2,0)');
          await db.exec('select public.legacy_write_rpc()');
          await db.exec('delete from public."Grows" where id=2');
        });
      }
      await asUser(db, 'Inactive', async () => {
        await assert.rejects(db.exec('select public.legacy_write_rpc()'), (error) => error.code === '42501');
      });
      assert.equal((await db.query('select mortality from public."Grows" where id=1')).rows[0].mortality, 13);
    } finally {
      await db.close();
    }
  });
}
