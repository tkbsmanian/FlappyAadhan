// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3333/index.html';

// Helper: ignore 404s from external CDNs (Google Fonts etc.)
function isExternalUrl(url) {
  return url.includes('fonts.googleapis.com') ||
         url.includes('fonts.gstatic.com') ||
         url.includes('cdn.') ||
         !url.startsWith('http://localhost');
}

test.describe('Flappy Kiro — smoke tests', () => {

  test('page loads with HTTP 200 and correct title', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle('Flappy Kiro');
  });

  test('canvas element is present and has correct logical dimensions', async ({ page }) => {
    await page.goto(BASE_URL);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const styleW = await canvas.evaluate(el => el.style.width);
    const styleH = await canvas.evaluate(el => el.style.height);
    expect(styleW).toBe('480px');
    expect(styleH).toBe('640px');
  });

  test('game starts in MENU state — canvas is rendering', async ({ page }) => {
    await page.goto(BASE_URL);

    // Wait for the game loop to paint at least one frame
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      const px = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      return px[3] > 0; // alpha > 0 means something was drawn
    }, { timeout: 5000 });
  });

  test('CONFIG object is frozen and exposes expected constants', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const g = window.__game;
      if (!g) return { ok: false, reason: 'window.__game not exposed' };
      const C = g.C;
      if (!C) return { ok: false, reason: 'C is not defined on __game' };
      if (!Object.isFrozen(C)) return { ok: false, reason: 'C is not frozen' };

      const required = [
        'CANVAS_W', 'CANVAS_H',
        'GRAVITY', 'ASCENT_VELOCITY', 'TERMINAL_VELOCITY',
        'PIPE_SPEED_INITIAL', 'PIPE_SPEED_MAX', 'PIPE_SPEED_THRESHOLD',
        'PIPE_GAP', 'PIPE_GAP_MIN_Y', 'PIPE_GAP_MAX_Y',
        'GHOSTY_W', 'GHOSTY_H', 'HITBOX_INSET',
        'INVINCIBILITY_MS', 'MAX_DELTA',
      ];
      const missing = required.filter(k => !(k in C));
      if (missing.length) return { ok: false, reason: `Missing keys: ${missing.join(', ')}` };
      return { ok: true };
    });
    expect(result.ok, result.reason).toBe(true);
  });

  test('game starts in MENU state', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(300);

    const state = await page.evaluate(() => window.__game?.state ?? 'unknown');
    expect(state).toBe('MENU');
  });

  test('game transitions to PLAYING state on Space key', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => window.__game?.state ?? 'unknown');
    expect(state).toBe('PLAYING');
    expect(errors).toHaveLength(0);
  });

  test('no console errors on load', async ({ page }) => {
    const errors = [];
    const failedUrls = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    page.on('requestfailed', req => failedUrls.push(req.url()));
    page.on('response', res => { if (res.status() >= 400) failedUrls.push(`${res.status()} ${res.url()}`); });

    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    // Filter errors that are caused by known external CDN failures (Google Fonts in headless)
    const localErrors = errors.filter(e => {
      const isExternalFailure = failedUrls.some(u => isExternalUrl(u));
      return !(isExternalFailure && e.includes('404'));
    });

    expect(localErrors, `Console errors:\n${localErrors.join('\n')}\nFailed URLs:\n${failedUrls.join('\n')}`).toHaveLength(0);
  });

  test('no console errors after starting and playing for 2 seconds', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await page.waitForTimeout(300);

    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }

    expect(errors, `Console errors during gameplay:\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('pause and resume works without errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await page.waitForTimeout(300);

    await page.keyboard.press('Space');       // start
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');      // pause
    await page.waitForTimeout(200);

    const paused = await page.evaluate(() => window.__game?.state);
    expect(paused).toBe('PAUSED');

    await page.keyboard.press('Escape');      // resume
    await page.waitForTimeout(200);

    const resumed = await page.evaluate(() => window.__game?.state);
    expect(resumed).toBe('PLAYING');

    expect(errors).toHaveLength(0);
  });

  test('local assets load without 404 errors', async ({ page }) => {
    const failed = [];
    page.on('response', res => {
      if (res.status() === 404 && !isExternalUrl(res.url())) {
        failed.push(res.url());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    expect(failed, `404s on local assets: ${failed.join(', ')}`).toHaveLength(0);
  });

});
