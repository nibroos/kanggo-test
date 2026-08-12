#!/usr/bin/env node
/**
 * Captures the README screenshots by driving the real app in a headless browser.
 *
 * Prerequisites: the stack must be running (`docker compose up -d`) and seeded
 * (`docker compose exec backend npm run seed`).
 *
 *   npm i -D puppeteer          # downloads its own Chrome
 *   node scripts/screenshots.mjs
 *
 * Options (environment variables):
 *   APP_URL          default http://localhost:4089
 *   API_URL          default http://localhost:4088
 *   CHROME_PATH      use an existing Chrome instead of Puppeteer's download
 *   OUT_DIR          default docs/screenshots
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const APP_URL = process.env.APP_URL || 'http://localhost:4089';
const API_URL = process.env.API_URL || 'http://localhost:4088';
const OUT_DIR = path.resolve(ROOT, process.env.OUT_DIR || 'docs/screenshots');

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'ada.lovelace1@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Password123!';

// Created during the run, then removed again so repeat runs do not pile up tasks.
const DEMO_TASK_TITLE = 'Prepare the demo video';

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const MOBILE = { width: 414, height: 896, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Puppeteer resolves its bundled Chrome; puppeteer-core needs an explicit path. */
function loadPuppeteer() {
  for (const name of ['puppeteer', 'puppeteer-core']) {
    try {
      return { lib: require(name), needsPath: name === 'puppeteer-core' };
    } catch {
      /* try the next one */
    }
  }
  throw new Error('Install puppeteer first:  npm i -D puppeteer');
}

const shots = [];

async function shot(page, name, description) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push({ name, description });
  console.log(`  ✓ ${name.padEnd(28)} ${description}`);
}

/** Vuetify animates dialogs and snackbars; give them a beat to settle. */
const settle = (page, ms = 450) => page.evaluate((delay) => new Promise((r) => setTimeout(r, delay)), ms);

async function waitForText(page, text, timeout = 10_000) {
  await page.waitForFunction(
    (needle) => document.body.innerText.includes(needle),
    { timeout },
    text,
  );
}

/** Finds the input inside the Vuetify field carrying `label`. */
async function fieldByLabel(page, label) {
  const handle = await page.evaluateHandle((text) => {
    const field = [...document.querySelectorAll('.v-input')].find((input) =>
      input.querySelector('label')?.textContent.trim().startsWith(text),
    );
    return field?.querySelector('input, textarea') || null;
  }, label);

  const element = handle.asElement();
  if (!element) throw new Error(`No field labelled "${label}"`);
  return element;
}

/** Types into a labelled field, replacing whatever is there. */
async function fillByLabel(page, label, value) {
  const element = await fieldByLabel(page, label);
  await element.click({ clickCount: 3 });
  await element.type(value, { delay: 12 });
}

/**
 * Empties a labelled field. Typing an empty string is a no-op, so the selection has
 * to be deleted explicitly for Vue to see an input event.
 */
async function clearByLabel(page, label) {
  const element = await fieldByLabel(page, label);
  await element.click();
  // Triple-click does not reliably select inside a Vuetify field; select-all does.
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
}

/** Clicks the first button whose visible text matches. */
async function clickText(page, text, selector = 'button, a') {
  const clicked = await page.evaluate(
    (needle, sel) => {
      const target = [...document.querySelectorAll(sel)].find(
        (node) => node.innerText.trim().toLowerCase() === needle.toLowerCase(),
      );
      if (!target) return false;
      target.click();
      return true;
    },
    text,
    selector,
  );
  if (!clicked) throw new Error(`No clickable element with text "${text}"`);
}

/** Filter tabs render their label followed by a count chip, so match on the prefix. */
async function clickTab(page, label) {
  const clicked = await page.evaluate((needle) => {
    const tab = [...document.querySelectorAll('.v-tab')].find((node) =>
      node.innerText.trim().toLowerCase().startsWith(needle.toLowerCase()),
    );
    if (!tab) return false;
    tab.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`No filter tab labelled "${label}"`);
}

/** Applies a theme through the same localStorage key the app reads on mount. */
async function setTheme(page, theme) {
  await page.evaluate((value) => localStorage.setItem('tm.theme', value), theme);
  await page.reload({ waitUntil: 'networkidle0' });
  await waitForText(page, 'My tasks');
  await settle(page, 600);
}

async function login(page) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });
  await fillByLabel(page, 'Email', DEMO_EMAIL);
  await fillByLabel(page, 'Password', DEMO_PASSWORD);
  await clickText(page, 'Sign in');
  await waitForText(page, 'My tasks');
  await page.waitForNetworkIdle({ idleTime: 400 }).catch(() => {});
}

/**
 * Removes the task the run creates, straight through the API. Keeps the script
 * idempotent: the demo account looks the same before and after.
 */
async function cleanupDemoTask() {
  const json = (response) => response.json();
  const login = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  }).then(json);

  const auth = { Authorization: `Bearer ${login.data.accessToken}` };
  const list = await fetch(
    `${API_URL}/api/tasks?search=${encodeURIComponent(DEMO_TASK_TITLE)}&limit=100`,
    { headers: auth },
  ).then(json);

  for (const task of list.data) {
    if (task.title !== DEMO_TASK_TITLE) continue;
    await fetch(`${API_URL}/api/tasks/${task.id}`, { method: 'DELETE', headers: auth });
  }
  return list.data.filter((task) => task.title === DEMO_TASK_TITLE).length;
}

async function main() {
  // Fail early with a clear message rather than screenshotting an error page.
  for (const [label, url] of [['frontend', APP_URL], ['API', `${API_URL}/health`]]) {
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) {
      throw new Error(`${label} is not reachable at ${url}. Start the stack with: docker compose up -d`);
    }
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const { lib: puppeteer, needsPath } = loadPuppeteer();
  const executablePath = process.env.CHROME_PATH;
  if (needsPath && !executablePath) {
    throw new Error('puppeteer-core needs CHROME_PATH pointing at a Chrome binary');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(DESKTOP);
    // Headless Chrome reports a dark OS preference, and the app honours it. Pin the
    // light theme so the set is consistent; the dark shot is taken deliberately below.
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

    // ---- Authentication -------------------------------------------------
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });
    await settle(page);
    await shot(page, '01-login', 'Login page');

    await clickText(page, 'Sign in');
    await settle(page);
    await shot(page, '02-login-validation', 'Client-side validation on an empty submit');

    await fillByLabel(page, 'Email', DEMO_EMAIL);
    await fillByLabel(page, 'Password', 'definitely-wrong');
    await clickText(page, 'Sign in');
    await waitForText(page, 'Invalid email or password');
    await settle(page);
    await shot(page, '03-login-error', 'Rejected credentials (401 from the API)');

    await page.goto(`${APP_URL}/register`, { waitUntil: 'networkidle0' });
    await fillByLabel(page, 'Name', 'Grace Hopper');
    await fillByLabel(page, 'Email', 'grace.demo@example.com');
    await fillByLabel(page, 'Password', 'Password123!');
    await settle(page);
    await shot(page, '04-register', 'Registration with the password strength meter');

    // Protected route with no token: the guard bounces to /login.
    await page.goto(`${APP_URL}/tasks`, { waitUntil: 'networkidle0' });
    await settle(page);
    await shot(page, '05-route-protection', 'Route guard redirects an anonymous visitor');

    // ---- Task list --------------------------------------------------------
    await login(page);
    // Let the "Welcome back" snackbar time out so it does not cover a task card.
    await settle(page, 4000);
    await shot(page, '06-task-list', 'Task list, sorted by soonest deadline');

    for (const [status, label] of [
      ['Pending', 'pending'],
      ['In Progress', 'in-progress'],
      ['Done', 'done'],
    ]) {
      await clickTab(page, status);
      await page.waitForNetworkIdle({ idleTime: 400 }).catch(() => {});
      await settle(page, 300);
      await shot(page, `07-filter-${label}`, `Status filter: ${status}`);
    }

    await clickTab(page, 'All');
    await page.waitForNetworkIdle({ idleTime: 400 }).catch(() => {});

    await fillByLabel(page, 'Search by title', 'deploy');
    await page.waitForNetworkIdle({ idleTime: 700 }).catch(() => {});
    await settle(page);
    await shot(page, '08-search', 'Debounced title search');

    // Clear the search so the rest of the run sees the full list.
    await clearByLabel(page, 'Search by title');
    await page.waitForNetworkIdle({ idleTime: 700 }).catch(() => {});
    await settle(page);
    await waitForText(page, 'ADD TASK');

    // ---- Create / edit / delete -------------------------------------------
    await clickText(page, 'Add task');
    await settle(page);
    await fillByLabel(page, 'Title', 'Prepare the demo video');
    await fillByLabel(page, 'Description', 'Walk through register, login, CRUD, filters and logout.');
    await settle(page);
    await shot(page, '09-create-dialog', 'Create task dialog');

    await clickText(page, 'Create task');
    await waitForText(page, 'Task created.');
    await settle(page);
    await shot(page, '10-create-success', 'Task created, with confirmation snackbar');

    // Empty title -> the form blocks the submit before any request goes out.
    await clickText(page, 'Add task');
    await settle(page);
    await clickText(page, 'Create task');
    await settle(page);
    await shot(page, '11-form-validation', 'Required-title validation in the form');
    await clickText(page, 'Cancel');
    await settle(page);

    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((node) =>
        node.getAttribute('aria-label')?.startsWith('Edit '),
      );
      button?.click();
    });
    await settle(page);
    await shot(page, '12-edit-dialog', 'Edit dialog, pre-filled with the current values');
    await clickText(page, 'Cancel');
    await settle(page);

    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((node) =>
        node.getAttribute('aria-label')?.startsWith('Delete '),
      );
      button?.click();
    });
    await settle(page);
    await shot(page, '13-delete-confirmation', 'Delete confirmation before anything is removed');
    await clickText(page, 'Cancel');
    await settle(page);

    // ---- Pagination and persistence ---------------------------------------
    await page.evaluate(() => {
      document.querySelector('.v-pagination__next button')?.click();
    });
    await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {});
    // The pager sits below the grid, so scroll it into frame.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await settle(page);
    await shot(page, '14-pagination', 'Server-side pagination, page 2');
    await page.evaluate(() => window.scrollTo(0, 0));

    await clickTab(page, 'Pending');
    await page.waitForNetworkIdle({ idleTime: 400 }).catch(() => {});
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForText(page, 'My tasks');
    await settle(page);
    await shot(page, '15-filters-persisted', 'Filters restored from localStorage after a reload');

    // ---- Theme, responsive, misc ------------------------------------------
    // Set the stored preference directly rather than clicking the toggle: which
    // label the button carries depends on the theme it is currently showing.
    await setTheme(page, 'dark');
    await shot(page, '16-dark-mode', 'Dark theme');
    await setTheme(page, 'light');

    await page.setViewport(MOBILE);
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForText(page, 'My tasks');
    await settle(page);
    await shot(page, '17-responsive-mobile', 'Mobile layout (414 x 896)');
    await page.setViewport(DESKTOP);
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForText(page, 'My tasks');
    await settle(page);

    // Logout, then prove the protected page is no longer reachable.
    await clickText(page, 'Logout');
    await waitForText(page, 'Sign in');
    await settle(page);
    await shot(page, '18-logout', 'Signed out, back at the login page');

    await page.goto(`${APP_URL}/tasks`, { waitUntil: 'networkidle0' });
    await settle(page);
    await shot(page, '19-protected-after-logout', 'Task page unreachable after logout');

    await page.goto(`${APP_URL}/nope`, { waitUntil: 'networkidle0' });
    await settle(page);
    await shot(page, '20-not-found', '404 page');

    // ---- API documentation --------------------------------------------------
    await page.goto(`${API_URL}/api/docs/`, { waitUntil: 'networkidle0' });
    await settle(page, 900);
    await shot(page, '21-swagger-ui', 'Swagger UI served by the API');

    console.log(`\n${shots.length} screenshots written to ${path.relative(ROOT, OUT_DIR)}/`);
  } finally {
    await browser.close();
    const removed = await cleanupDemoTask().catch(() => 0);
    if (removed) console.log(`Cleaned up ${removed} demo task(s).`);
  }
}

main().catch((error) => {
  console.error(`\nScreenshot run failed: ${error.message}`);
  process.exitCode = 1;
});
