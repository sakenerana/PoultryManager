import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReadOnlyFetch } from '../src/utils/readOnlyFetch.ts';
import { toRole } from '../src/type/user.types.ts';

const origin = 'https://poultry.example.test';
const userId = '00000000-0000-4000-8000-000000000001';
const token = `test.${Buffer.from(JSON.stringify({ sub: userId })).toString('base64url')}.test`;
const headers = { Authorization: `Bearer ${token}`, apikey: 'test-public-key' };

function fixture(role = 'Viewer', status = 'Active', options = {}) {
  const calls = [];
  const baseFetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push(request);
    if (request.url.includes('/rest/v1/Users?')) {
      if (options.failure) return new Response('unavailable', { status: 500 });
      return Response.json(options.missing ? [] : [{ role, status }]);
    }
    return Response.json({ ok: true });
  };
  return { calls, fetch: createReadOnlyFetch(baseFetch, origin, 'Users') };
}

test('Viewer is recognized without converting it to Staff', () => {
  assert.equal(toRole('Viewer'), 'Viewer');
  assert.equal(toRole('Admin'), 'Admin');
  assert.equal(toRole('unknown'), null);
});

test('Viewers can read records with filters, reports, and HEAD counts', async () => {
  const app = fixture();
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal((await app.fetch(`${origin}/rest/v1/Grows?select=*&building_id=eq.1`, { method, headers })).status, 200);
  }
  assert.equal(app.calls.length, 3);
});

for (const [method, path] of [
  ['POST', '/rest/v1/GrowLogs'], ['PATCH', '/rest/v1/Users?id=eq.1'],
  ['PUT', '/rest/v1/FeedsConsumption'], ['DELETE', '/rest/v1/HarvestTrucks?id=eq.1'],
  ['POST', '/rest/v1/rpc/create_grow_bundle'], ['POST', '/storage/v1/object/uploads/a.pdf'],
]) {
  test(`Viewer ${method} ${path} is blocked before mutation`, async () => {
    const app = fixture();
    const response = await app.fetch(`${origin}${path}`, { method, headers, body: '{}' });
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /read-only/);
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].method, 'GET');
    assert.equal(new URL(app.calls[0].url).searchParams.get('user_uuid'), `eq.${userId}`);
  });
}

test('Request objects are protected as well as string URLs', async () => {
  const app = fixture();
  const request = new Request(`${origin}/rest/v1/Grows`, { method: 'POST', headers, body: '{}' });
  assert.equal((await app.fetch(request)).status, 403);
});

for (const role of ['Admin', 'Supervisor', 'Staff']) {
  test(`${role} writes reach the existing application/database permissions`, async () => {
    const app = fixture(role);
    const response = await app.fetch(`${origin}/rest/v1/GrowLogs`, { method: 'POST', headers, body: '{"mortality":5}' });
    assert.equal(response.status, 200);
    assert.equal(app.calls.length, 2);
    assert.equal(await app.calls[1].text(), '{"mortality":5}');
  });
}

test('Inactive, missing, unknown, or unreadable profiles cannot write', async () => {
  for (const app of [fixture('Staff', 'Inactive'), fixture('Unknown'), fixture('Viewer', 'Active', { missing: true }), fixture('Staff', 'Active', { failure: true })]) {
    assert.equal((await app.fetch(`${origin}/rest/v1/Grows`, { method: 'POST', headers })).status, 403);
    assert.equal(app.calls.length, 1);
  }
});

test('Role is freshly checked on every mutation, including after a demotion', async () => {
  let role = 'Admin';
  let writes = 0;
  const guardedFetch = createReadOnlyFetch(async (input) => {
    const request = new Request(input);
    if (request.method === 'GET') return Response.json([{ role, status: 'Active' }]);
    writes++;
    return Response.json({ ok: true });
  }, origin, 'Users');
  assert.equal((await guardedFetch(`${origin}/rest/v1/Grows`, { method: 'POST', headers })).status, 200);
  role = 'Viewer';
  assert.equal((await guardedFetch(`${origin}/rest/v1/Grows`, { method: 'POST', headers })).status, 403);
  assert.equal(writes, 1);
});

test('Sign in, sign out, password recovery, and external requests still work', async () => {
  const app = fixture();
  for (const path of ['/auth/v1/token', '/auth/v1/logout', '/auth/v1/recover']) {
    assert.equal((await app.fetch(`${origin}${path}`, { method: 'POST', headers })).status, 200);
  }
  assert.equal((await app.fetch('https://other.example.test/rest/v1/endpoint', { method: 'POST' })).status, 200);
  assert.equal(app.calls.length, 4);
});
