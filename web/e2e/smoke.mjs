/**
 * StudyMate end-to-end smoke test.
 *
 * Drives a real Chromium against a running dev server and asserts the flows a
 * student actually performs. Fails loudly; a green run means these paths work,
 * not merely that the app compiles.
 *
 *   node --env-file=.env.local e2e/smoke.mjs [baseURL]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const EMAIL = 'e2e@studymate.test';
const PASSWORD = 'TestPassword123!';
const SHOTS = 'e2e/screenshots';

const results = [];
const skipped = [];
const consoleErrors = [];
const pageErrors = [];

function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

/**
 * Supabase must be reachable from this machine for the authenticated half of
 * the suite to mean anything. Sandboxed CI and locked-down corporate networks
 * often block it; in that case say so plainly rather than reporting a wall of
 * misleading failures.
 */
async function supabaseReachable() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return { ok: false, why: 'NEXT_PUBLIC_SUPABASE_URL is not set' };
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? { ok: true } : { ok: false, why: `health check returned ${res.status}` };
  } catch (err) {
    return { ok: false, why: String(err?.cause?.message ?? err?.message ?? err) };
  }
}

async function run() {
  mkdirSync(SHOTS, { recursive: true });

  const reach = await supabaseReachable();
  if (!reach.ok) {
    console.log('─'.repeat(70));
    console.log('Supabase is NOT reachable from this machine:');
    console.log(`  ${reach.why}`);
    console.log('');
    console.log('Running only the checks that do not need it. Anything involving');
    console.log('sign-in, the dashboard or search is SKIPPED, not passed.');
    console.log('─'.repeat(70));
  }

  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  try {
    // ---------------------------------------------------- unauthenticated
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    check('Landing page renders', await page.getByRole('heading', { level: 1 }).isVisible());

    // The proxy must bounce a signed-out visitor off an app route.
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    check(
      'Signed-out user is redirected away from /home',
      page.url().includes('/login'),
      page.url().replace(BASE, ''),
    );
    check(
      'Redirect preserves intended destination',
      page.url().includes('next=%2Fhome') || page.url().includes('next=/home'),
    );

    if (!reach.ok) {
      // Everything past this point needs a working database.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      const narrow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      check('No horizontal scroll on login at 390px', !narrow);
      await page.screenshot({ path: `${SHOTS}/mobile-login.png`, fullPage: true });

      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
      check('Signup page renders', await page.getByRole('heading', { level: 1 }).isVisible());
      await page.screenshot({ path: `${SHOTS}/signup.png`, fullPage: true });

      await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
      check('Password reset page renders', await page.getByRole('heading', { level: 1 }).isVisible());

      skipped.push(
        'sign-in', 'onboarding', 'dashboard', 'search', 'dark mode persistence',
        'mobile tab bar', 'skip link', 'sign out',
      );
      return;
    }

    // ---------------------------------------------------- bad credentials
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    const alert = page.getByRole('alert');
    await alert.waitFor({ state: 'visible', timeout: 15000 });
    const alertText = (await alert.textContent())?.trim() ?? '';
    check(
      'Wrong password shows a human error',
      /does not match an account/i.test(alertText),
      alertText.slice(0, 60),
    );
    check(
      'Error message leaks no internals',
      !/AuthApiError|supabase|4\d\d|stack/i.test(alertText),
    );
    await page.screenshot({ path: `${SHOTS}/01-login-error.png` });

    // ---------------------------------------------------- real sign-in
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(onboarding|home)/, { timeout: 20000 });
    check('Sign-in succeeds', true, page.url().replace(BASE, ''));

    // ---------------------------------------------------- onboarding
    if (page.url().includes('/onboarding')) {
      check('New account is sent to onboarding', true);
      await page.screenshot({ path: `${SHOTS}/02-onboarding.png` });

      await page.locator('input[name="course"]').fill('BE Mechanical Engineering');
      await page.locator('input[name="institution"]').fill('Anna University');
      await page.locator('input[name="semester"]').fill('5');
      await page.locator('input[name="subject_name"]').fill('Engineering Mathematics');
      await page.getByRole('button', { name: /^continue$/i }).click();
      await page.waitForURL(/\/home/, { timeout: 20000 });
      check('Onboarding completes and lands on the dashboard', true);
    }

    // ---------------------------------------------------- dashboard
    await page.waitForLoadState('networkidle');
    const heading = await page.getByRole('heading', { level: 1 }).first().textContent();
    check(
      'Dashboard states the actual situation',
      /nothing is due today|thing(s)? to finish today/i.test(heading ?? ''),
      (heading ?? '').trim(),
    );
    check(
      'Onboarding subject appears in the app',
      (await page.getByText('Engineering Mathematics').count()) > 0 ||
        (await page.getByText(/create your first subject/i).count()) === 0,
    );
    await page.screenshot({ path: `${SHOTS}/03-dashboard-light.png`, fullPage: true });

    // ---------------------------------------------------- dark mode
    await page.getByRole('radio', { name: 'Dark' }).click();
    await page.waitForTimeout(350);
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    check('Dark mode applies', isDark);
    await page.screenshot({ path: `${SHOTS}/04-dashboard-dark.png`, fullPage: true });

    // Theme must survive a reload -- the mobile app lost it on every launch.
    await page.reload({ waitUntil: 'networkidle' });
    const stillDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    check('Dark mode persists across reload', stillDark);

    // ---------------------------------------------------- search
    await page.keyboard.press('Control+k');
    const searchBox = page.getByRole('dialog', { name: /search/i });
    await searchBox.waitFor({ state: 'visible', timeout: 5000 });
    check('Cmd/Ctrl-K opens search', true);

    await page.getByLabel('Search query').fill('Engineering');
    await page.waitForTimeout(900);
    const optionCount = await page.getByRole('option').count();
    check(
      'Search returns the subject created during onboarding',
      optionCount > 0,
      `${optionCount} result(s)`,
    );
    await page.screenshot({ path: `${SHOTS}/05-search.png` });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check('Escape closes search', !(await searchBox.isVisible().catch(() => false)));

    // ---------------------------------------------------- mobile layout
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    const tabBar = page.getByRole('navigation', { name: 'Main' }).last();
    check('Mobile shows a bottom tab bar', await tabBar.isVisible());

    const scrollsSideways = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check('No horizontal scroll at 390px', !scrollsSideways);
    await page.screenshot({ path: `${SHOTS}/06-mobile.png`, fullPage: true });

    // ---------------------------------------------------- keyboard access
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const firstStop = await page.evaluate(() => document.activeElement?.textContent?.trim());
    check('First tab stop is the skip link', /skip to content/i.test(firstStop ?? ''), firstStop);

    // ---------------------------------------------------- sign out
    await page.getByRole('button', { name: /alex kumar|e2e@studymate/i }).first().click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 20000 });
    check('Sign out returns to login', true);

    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    check('Session is really gone after sign out', page.url().includes('/login'));
  } finally {
    await browser.close();
    // In the finally, not after it. The unreachable-Supabase path returns early
    // from the middle of the try, which used to skip the report entirely: no
    // tally, no SKIPPED list, and -- worst -- the failure check never ran, so a
    // failing unauthenticated check still exited 0. The report has to run on
    // every path out of this function, which is what `finally` is for.
    report();
  }
}

// ------------------------------------------------------------- report
function report() {
  check('No uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  // 'hydrat' is deliberately NOT filtered. It used to be, which hid a real
  // hydration mismatch on <html> from every run: the suite reported "No console
  // errors" while every dark-mode visitor hit one. A hydration error is a bug,
  // not noise.
  const realConsoleErrors = consoleErrors.filter(
    (e) => !/favicon|Download the React DevTools/i.test(e),
  );
  check(
    'No console errors',
    realConsoleErrors.length === 0,
    realConsoleErrors.slice(0, 2).join(' | '),
  );

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks ran and passed`);
  if (skipped.length) {
    console.log(`\n${skipped.length} checks SKIPPED (Supabase unreachable): ${skipped.join(', ')}`);
    console.log('These are NOT passing -- they were never run.');
  }
  if (failed.length) {
    console.log('\nFAILED:');
    for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
    // exitCode rather than exit(): this runs inside a finally, and exiting here
    // would swallow an in-flight exception before the catch below can report it.
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('E2E run crashed:', err);
  process.exit(1);
});
