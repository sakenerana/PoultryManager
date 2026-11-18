import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const bootstrap = await readFile(new URL('../public/pwa-install.js', import.meta.url), 'utf8');

function browser({ standalone = false, secure = true, userAgent = 'Chrome Android', legacyMedia = false } = {}) {
  const window = new EventTarget();
  const media = new EventTarget();
  media.matches = standalone;
  if (legacyMedia) {
    media.addListener = (listener) => EventTarget.prototype.addEventListener.call(media, 'change', listener);
    media.addEventListener = undefined;
  }
  window.matchMedia = () => media;
  window.isSecureContext = secure;
  const context = vm.createContext({ window, navigator: { userAgent }, Object, Set });
  vm.runInContext(bootstrap, context);
  return { window, media, context, manager: window.gpmInstall };
}

function offer(window, outcome = 'accepted', implementation = async () => {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  let calls = 0;
  event.prompt = () => { calls++; return implementation(); };
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return { event, calls: () => calls };
}

test('an install prompt arriving before Settings mounts is retained across subscriptions', () => {
  const { manager, window } = browser();
  const { event } = offer(window);
  assert.equal(event.defaultPrevented, true);
  assert.equal(manager.getSnapshot().canInstall, true);
  const unsubscribe = manager.subscribe(() => {});
  unsubscribe();
  assert.equal(manager.getSnapshot().canInstall, true);
  assert.equal(manager.getSnapshot(), manager.getSnapshot());
});

test('prompt runs immediately within the button gesture and is only used once', async () => {
  const { manager, window } = browser();
  let resolvePrompt;
  const offered = offer(window, 'accepted', () => new Promise((resolve) => { resolvePrompt = resolve; }));
  const installing = manager.install();
  assert.equal(offered.calls(), 1);
  assert.equal(manager.getSnapshot().isPrompting, true);
  assert.equal(manager.getSnapshot().canInstall, false);
  assert.equal((await manager.install()).outcome, 'unavailable');
  resolvePrompt();
  assert.equal((await installing).outcome, 'accepted');
  assert.equal(manager.getSnapshot().isInstalled, false, 'accepting the prompt is not completion');
  assert.equal((await manager.install()).outcome, 'unavailable');
});

test('a new prompt offered during dismissal is not lost', async () => {
  const { manager, window } = browser();
  let finish;
  offer(window, 'dismissed', () => new Promise((resolve) => { finish = resolve; }));
  const installing = manager.install();
  const nextOffer = offer(window);
  finish();
  assert.equal((await installing).outcome, 'dismissed');
  assert.equal(manager.getSnapshot().canInstall, true);
  assert.equal((await manager.install()).outcome, 'accepted');
  assert.equal(nextOffer.calls(), 1);
});

test('installation from the Chrome menu updates late subscribers', async () => {
  const { manager, window } = browser();
  offer(window);
  window.dispatchEvent(new Event('appinstalled'));
  assert.equal(manager.getSnapshot().isInstalled, true);
  assert.equal(manager.getSnapshot().canInstall, false);
  assert.equal((await manager.install()).outcome, 'unavailable');
});

test('failed prompts recover without unhandled rejections', async () => {
  const { manager, window } = browser();
  offer(window, 'accepted', async () => { throw new Error('browser rejected prompt'); });
  assert.equal((await manager.install()).outcome, 'error');
  assert.equal(manager.getSnapshot().isPrompting, false);
  offer(window);
  assert.equal((await manager.install()).outcome, 'accepted');
});

test('insecure origins do not expose an install prompt', async () => {
  const { manager, window } = browser({ secure: false });
  offer(window);
  assert.equal(manager.getSnapshot().isSecureContext, false);
  assert.equal(manager.getSnapshot().canInstall, false);
  assert.equal((await manager.install()).outcome, 'unavailable');
});

test('standalone launch, display-mode changes, and legacy media listeners are recognized', () => {
  assert.equal(browser({ standalone: true }).manager.getSnapshot().isInstalled, true);
  for (const legacyMedia of [false, true]) {
    const { manager, media } = browser({ legacyMedia });
    media.matches = true;
    media.dispatchEvent(new Event('change'));
    assert.equal(manager.getSnapshot().isInstalled, true);
  }
});

test('subscribers are notified, cleaned up, and bootstrap is idempotent', () => {
  const { manager, window, context } = browser();
  let updates = 0;
  const unsubscribe = manager.subscribe(() => { updates++; });
  offer(window);
  assert.equal(updates, 1);
  unsubscribe();
  vm.runInContext(bootstrap, context);
  assert.equal(window.gpmInstall, manager);
  offer(window);
  assert.equal(updates, 1);
});

test('iOS and embedded Android browsers receive the correct guidance state', () => {
  assert.equal(browser({ userAgent: 'iPhone AppleWebKit Safari' }).manager.getSnapshot().platform, 'ios');
  assert.equal(browser({ userAgent: 'Android; wv) Instagram' }).manager.getSnapshot().isEmbedded, true);
});

test('the early script precedes React and PNG dimensions match the manifest', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('src="/pwa-install.js"') >= 0);
  assert.ok(html.indexOf('src="/pwa-install.js"') < html.indexOf('src="/src/main.tsx"'));
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((entry) => entry.sizes === `${size}x${size}`);
    assert.ok(icon, `${size}px manifest icon`);
    const png = await readFile(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
