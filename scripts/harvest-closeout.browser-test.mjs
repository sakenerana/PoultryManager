import assert from 'node:assert/strict';
import { loadEnv } from 'vite';

// Run against a production preview. Every API request is intercepted; no farm data is changed.
const { chromium } = await import(process.env.HARVEST_PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.HARVEST_TEST_URL || 'http://127.0.0.1:4173';
const env = loadEnv('production', process.cwd(), 'VITE_');
const api = new URL(env.VITE_SUPABASE_URL);
const user = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'harvest-test@example.invalid', created_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, aud: 'authenticated', role: 'authenticated' })}.test`;
const session = { access_token: token, refresh_token: 'test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user };
const storageKey = `sb-${api.hostname.split('.')[0]}-auth-token`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.HARVEST_CHROMIUM_EXECUTABLE ? { executablePath: process.env.HARVEST_CHROMIUM_EXECUTABLE } : {}),
});

function fixture(buildingId = 6) {
  const growId = buildingId === 6 ? 19 : 20;
  const harvestId = buildingId === 6 ? 20 : 21;
  const growMortality = buildingId === 6 ? 2457 : 2655;
  const initialReductions = buildingId === 6 ? 1311 : 3383;
  return {
    Buildings: [{ id: buildingId, name: `Bldg ${buildingId}` }],
    Grows: [{ id: growId, building_id: buildingId, created_at: '2026-10-12T12:00:00Z', total_animals: 105000,
      status: 'Growing', is_harvested: false }],
    Load: [{ id: 1, grow_id: growId }],
    LoadTransactions: [{ id: 1, load_id: 1, animal_count: 105000, created_at: '2026-10-12T12:00:00Z' }],
    DOATransactions: [{ id: 1, grow_id: growId, total_animals_count: buildingId === 6 ? 156 : 191, created_at: '2026-10-12T12:00:00Z' }],
    CulledTransactions: [], TransferTransactions: [],
    GrowLogs: [{ id: 1, grow_id: growId, subbuilding_id: 1, mortality: growMortality, thinning: 0, take_out: 0,
      actual_total_animals: buildingId === 6 ? 102488 : 102154, created_at: '2026-11-11T12:00:00Z' }],
    GrowReductionTransactions: [{ id: 1, grow_id: growId, subbuilding_id: 1, reduction_type: 'mortality',
      animal_count_to_deduct: growMortality, created_at: '2026-11-11T12:00:00Z' }],
    Harvest: [{ id: harvestId, grow_id: growId, building_id: buildingId, status: 'Loading',
      total_animals_out: buildingId === 6 ? 100792 : 97312, created_at: '2026-11-12T12:00:00Z' }],
    HarvestTrucks: [{ id: 1, harvest_id: harvestId, name: 'Test truck', plate_no: 'TEST', status: 'Completed',
      animals_loaded: buildingId === 6 ? 100792 : 97312, weight_no_load: 1000, weight_with_load: 150000,
      created_at: '2026-11-12T12:00:00Z' }],
    HarvestLogs: [],
    HarvestReductionTransactions: [
      { id: 1, harvest_id: harvestId, harvest_log_id: null, reduction_type: 'mortality',
        animal_count_to_deduct: initialReductions, created_at: '2026-11-12T12:00:00Z' },
      ...(buildingId === 4 ? [{ id: 2, harvest_id: harvestId, harvest_log_id: null, reduction_type: 'defect',
        animal_count_to_deduct: 272, created_at: '2026-11-13T12:00:00Z' }] : []),
    ],
  };
}

function filtered(rows, params) {
  let result = rows.filter(row => [...params].every(([key, filter]) => {
    if (['select', 'order', 'limit', 'offset'].includes(key)) return true;
    const dot = filter.indexOf('.');
    const operator = filter.slice(0, dot), value = filter.slice(dot + 1);
    const actual = row[key];
    if (operator === 'eq') return String(actual) === value;
    if (operator === 'in') return value.slice(1, -1).split(',').includes(String(actual));
    if (operator === 'lt') return Date.parse(actual) < Date.parse(value);
    if (operator === 'lte') return Date.parse(actual) <= Date.parse(value);
    if (operator === 'gte') return Date.parse(actual) >= Date.parse(value);
    throw new Error(`Unhandled fixture filter: ${key}=${filter}`);
  }));
  const order = params.get('order');
  if (order) {
    const [key, direction] = order.split('.');
    result = [...result].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (direction === 'desc' ? -1 : 1));
  }
  return result.slice(0, Number(params.get('limit') || result.length));
}

async function runCase({ name, buildingId = 6, metric = 'defect', value = 284, remaining = 284, role = 'Admin', rpcFallback = false, workflow = 'reduction' }) {
  if (process.env.HARVEST_TEST_CASE && !name.includes(process.env.HARVEST_TEST_CASE)) return;
  const tables = fixture(buildingId);
  if (workflow === 'truck') {
    tables.HarvestTrucks.push({ id: 2, harvest_id: 20, name: 'Final truck', plate_no: 'FINAL', status: 'Loading',
      animals_loaded: 0, weight_no_load: 1000, weight_with_load: 0, created_at: '2026-11-23T12:00:00Z' });
  }
  const writes = [], errors = [];
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Shanghai', viewport: { width: 1365, height: 900 } });
  await context.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), { storageKey, session });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    // Only the local frontend is allowed through; all API operations use this in-memory fixture.
    if (url.origin === new URL(baseURL).origin) return route.continue();
    if (url.origin !== api.origin) return route.abort();
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    try {
      const method = request.method(), table = url.pathname.split('/').at(-1);
      if (url.pathname === '/auth/v1/user') return reply(user);
      if (method === 'OPTIONS') return reply({});
      const single = request.headers().accept?.includes('vnd.pgrst.object');
      if (table === (env.VITE_SUPABASE_USERS_TABLE || 'Users')) {
        const profile = { id: 1, user_uuid: user.id, role, status: 'Active', building_id: null };
        return reply(single ? profile : [profile]);
      }
      if (url.pathname.includes('/rpc/')) {
        writes.push({ table, method, payload: request.postDataJSON() });
        assert.equal(table, env.VITE_SUPABASE_RPC_UPDATE_GROW || 'rpc_update_grow_bundle');
        if (rpcFallback) return reply({ message: 'Fixture RPC unavailable', code: 'PGRST202' }, 404);
        const payload = request.postDataJSON();
        Object.assign(tables.Grows.find(row => row.id === payload.p_grow_id), payload.p_payload.grow);
        return reply(tables.Grows[0]);
      }
      if (method === 'GET') {
        const rows = filtered(tables[table] || [], url.searchParams);
        return reply(single ? rows[0] ?? null : rows);
      }
      assert.ok(['HarvestLogs', 'HarvestReductionTransactions', 'Harvest', 'HarvestTrucks', 'Grows'].includes(table), `Unexpected write to ${table}`);
      const payload = request.postDataJSON();
      writes.push({ table, method, payload });
      let rows;
      if (method === 'POST') {
        rows = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: (tables[table].at(-1)?.id || 0) + 1, ...row }));
        tables[table].push(...rows);
      } else {
        assert.equal(method, 'PATCH');
        rows = filtered(tables[table], url.searchParams);
        rows.forEach(row => Object.assign(row, payload));
      }
      return reply(single ? rows[0] : rows);
    } catch (error) {
      errors.push(error.message);
      return reply({ message: error.message }, 400);
    }
  });
  const page = await context.newPage();
  try {
    if (workflow === 'overview') {
      await page.goto(`${baseURL}/harvest?date=2026-11-23`);
      const card = page.locator('.ant-card').filter({ hasText: 'Bldg 6' });
      const total = card.getByText('Total Birds', { exact: true }).locator('..');
      await total.getByText('102,387', { exact: true }).waitFor();
      const current = card.getByText('Current', { exact: true }).locator('..');
      await current.getByText(/284/).waitFor();
      assert.deepEqual(writes, []);
    } else if (workflow === 'truck') {
      await page.goto(`${baseURL}/truck/6?date=2026-11-23`);
      await page.getByRole('button').filter({ hasText: 'Load Truck' }).click();
      const drawer = page.locator('.load-truck-drawer');
      await drawer.getByText('284', { exact: true }).waitFor();
      await drawer.getByLabel('Weight of Truck(Loaded)').fill('1400');
      await drawer.getByLabel('Birds Load').fill('284');
      await drawer.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByText('Truck loaded successfully.', { exact: true }).waitFor();
      assert.equal(tables.Harvest[0].total_animals_out, 101076);
      assert.equal(tables.Harvest[0].status, 'Completed');
      assert.equal(tables.Grows[0].status, 'Harvested');
      assert.equal(tables.Grows[0].is_harvested, true);
    } else {
      await page.goto(`${baseURL}/harvest-metric-history/${buildingId}/${metric}?date=2026-11-23`);
      await page.getByText(`${metric === 'defect' ? 'Defect' : 'Mortality'} Daily History`, { exact: true }).waitFor();
      const dateText = buildingId === 6 ? 'November 14, 2026' : 'November 22, 2026';
      if (role === 'Viewer') {
        assert.equal(await page.getByRole('button').filter({ hasText: dateText }).count(), 0);
        await page.getByText(dateText, { exact: true }).click();
        assert.equal(await page.locator('.harvest-metric-day-drawer').count(), 0);
        assert.deepEqual(writes, []);
      } else {
        await page.getByRole('button').filter({ hasText: dateText }).click();
        const drawer = page.locator('.harvest-metric-day-drawer');
        await drawer.waitFor({ state: 'visible' });
        assert.match(await drawer.innerText(), new RegExp(`Remaining: ${remaining.toLocaleString('en-US')}`));
        await drawer.getByRole('spinbutton').fill(String(value));
        const reload = page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() });
        await drawer.getByRole('button', { name: 'Save', exact: true }).click();
        await reload;
        const completed = value === remaining;
        assert.equal(tables.Harvest[0].status, completed ? 'Completed' : 'Loading');
        assert.equal(tables.Grows[0].status, completed ? 'Harvested' : 'Growing');
        assert.equal(tables.Grows[0].is_harvested, completed);
        const enteredRows = tables.HarvestReductionTransactions.filter(row => row.reduction_type === metric && row.created_at.startsWith(buildingId === 6 ? '2026-11-14' : '2026-11-22'));
        assert.equal(enteredRows.length, 1, 'one reduction transaction is saved');
        assert.equal(enteredRows[0].animal_count_to_deduct, value);
        if (rpcFallback) assert.ok(writes.some(write => write.table === 'Grows' && write.method === 'PATCH'));
        if (!completed) assert.ok(writes.every(write => !['Harvest', 'Grows'].includes(write.table) && !write.table.startsWith('rpc_')));
      }
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error({ scenario: name, fixtureErrors: errors, page: (await page.locator('body').innerText()).slice(-3500) });
    throw error;
  } finally {
    await context.close();
  }
}

try {
  await runCase({ name: '284 Defect closes Building 6 despite stale 102,488 snapshot' });
  await runCase({ name: '283 Defect leaves one bird and keeps grow open', value: 283 });
  await runCase({ name: 'final Mortality also closes with the calculated balance', metric: 'mortality' });
  await runCase({ name: 'Building 4 mortality closeout remains supported', buildingId: 4, metric: 'mortality', value: 1187, remaining: 1187 });
  await runCase({ name: 'direct grow update closes when RPC is unavailable', rpcFallback: true });
  await runCase({ name: 'Viewer remains unable to edit harvest reductions', role: 'Viewer' });
  await runCase({ name: 'overview shows the same 102,387 starting balance and 284 remaining', workflow: 'overview' });
  await runCase({ name: 'final truck closes using calculated balance rather than saved snapshot', workflow: 'truck' });
  console.log(`${process.env.HARVEST_TEST_CASE ? 'Selected' : '8'} harvest closeout browser scenarios passed; API writes were mocked.`);
} finally {
  await browser.close();
}
