import assert from 'node:assert/strict';
import { loadEnv } from 'vite';

// Use a locally available Playwright install or set PWA_PLAYWRIGHT_MODULE.
const { chromium } = await import(process.env.PWA_PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.PWA_TEST_URL || 'http://127.0.0.1:4173';
const env = loadEnv('production', process.cwd(), 'VITE_');
const api = new URL(env.VITE_SUPABASE_URL);
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated', role: 'authenticated', email: 'install-test@example.invalid',
  created_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, aud: 'authenticated', role: 'authenticated' })}.test`;
const session = { access_token: token, refresh_token: 'test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user };
const profile = { id: 1, user_uuid: user.id, role: 'Admin', status: 'Active', building_id: null };
const storageKey = `sb-${api.hostname.split('.')[0]}-auth-token`;

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PWA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PWA_CHROMIUM_EXECUTABLE } : {}),
});
let checks = 0;

async function createContext(options = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', ...options });
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, { storageKey, session });
  await context.route(`${api.origin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    assert.ok(['GET', 'HEAD', 'OPTIONS'].includes(request.method()), 'browser tests never write farm data');
    const body = url.pathname.endsWith('/auth/v1/user') ? user
      : url.pathname.endsWith(`/${env.VITE_SUPABASE_USERS_TABLE || 'Users'}`)
        ? request.headers().accept?.includes('vnd.pgrst.object') ? profile : [profile]
        : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'content-range': '0-0/0' } });
  });
  return context;
}

async function offer(page, outcome = 'accepted') {
  await page.evaluate((outcome) => {
    window.__installCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.__installCalls++; };
    event.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(event);
  }, outcome);
}

try {
  const desktop = await createContext({ viewport: { width: 1365, height: 900 } });
  const page = await desktop.newPage();
  await page.goto(baseURL);
  await page.waitForURL('**/landing-page');
  await page.waitForFunction(() => !!window.gpmInstall);
  await offer(page);
  // The install event happens on another route, before Settings mounts.
  await page.evaluate(() => {
    history.pushState(null, '', '/settings');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const installButton = page.getByRole('button', { name: 'Install App', exact: true });
  await installButton.waitFor({ state: 'visible' });
  assert.equal(await page.getByText('Ready', { exact: true }).count(), 1);
  checks++;
  await installButton.click();
  await page.getByText('App installation started.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__installCalls), 1);
  checks++;
  await offer(page, 'dismissed');
  await installButton.click();
  await page.getByText('App installation was canceled.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.gpmInstall.getSnapshot().isInstalled), false);
  checks++;
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await page.getByText('This app is running in installed mode.').waitFor();
  assert.equal(await installButton.count(), 0);
  checks++;
  await desktop.close();

  const android = await createContext({
    viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const phone = await android.newPage();
  await phone.goto(`${baseURL}/settings`);
  await phone.getByText(/In Chrome, tap the three-dot menu/).waitFor();
  assert.equal(await phone.getByText('Install button appears when your browser makes this app installable.').count(), 0);
  checks++;
  await offer(phone);
  await phone.getByRole('button', { name: 'Install App', exact: true }).waitFor();
  await phone.getByRole('button', { name: 'Install App', exact: true }).click();
  await phone.getByText('App installation started.', { exact: true }).waitFor();
  checks++;
  await android.close();

  const ios = await createContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const iphone = await ios.newPage();
  await iphone.goto(`${baseURL}/settings`);
  await iphone.getByText(/On iPhone or iPad, open this site in Safari/).waitFor();
  checks++;
  await ios.close();

  const assets = await browser.newContext();
  for (const [path, type] of [
    ['/pwa-install.js', 'javascript'], ['/manifest.webmanifest', 'manifest'],
    ['/icons/balao-pwa-192.png', 'image/png'], ['/icons/balao-pwa-512.png', 'image/png'],
  ]) {
    const response = await assets.request.get(`${baseURL}${path}`);
    assert.equal(response.status(), 200, path);
    assert.ok(response.headers()['content-type']?.includes(type), `${path}: correct content type`);
    checks++;
  }
  await assets.close();
  console.log(`${checks} production-browser install checks passed (desktop, Android/iOS emulation, and assets).`);
  console.log('Native installation on a physical Android device still requires verification after deployment.');
} finally {
  await browser.close();
}
