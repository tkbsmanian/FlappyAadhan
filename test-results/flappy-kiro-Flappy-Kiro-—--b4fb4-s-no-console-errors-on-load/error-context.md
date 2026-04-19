# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flappy-kiro.spec.js >> Flappy Kiro — smoke tests >> no console errors on load
- Location: playwright-tests/flappy-kiro.spec.js:95:3

# Error details

```
Error: Console errors found:
Failed to load resource: the server responded with a status of 404 (File not found)
404 URLs: 

expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  ["Failed to load resource: the server responded with a status of 404 (File not found)"]
```

# Test source

```ts
  10  |          url.includes('cdn.') ||
  11  |          !url.startsWith('http://localhost');
  12  | }
  13  | 
  14  | test.describe('Flappy Kiro — smoke tests', () => {
  15  | 
  16  |   test('page loads with HTTP 200 and correct title', async ({ page }) => {
  17  |     const response = await page.goto(BASE_URL);
  18  |     expect(response.status()).toBe(200);
  19  |     await expect(page).toHaveTitle('Flappy Kiro');
  20  |   });
  21  | 
  22  |   test('canvas element is present and has correct logical dimensions', async ({ page }) => {
  23  |     await page.goto(BASE_URL);
  24  |     const canvas = page.locator('canvas');
  25  |     await expect(canvas).toBeVisible();
  26  | 
  27  |     const styleW = await canvas.evaluate(el => el.style.width);
  28  |     const styleH = await canvas.evaluate(el => el.style.height);
  29  |     expect(styleW).toBe('480px');
  30  |     expect(styleH).toBe('640px');
  31  |   });
  32  | 
  33  |   test('game starts in MENU state — canvas is rendering', async ({ page }) => {
  34  |     await page.goto(BASE_URL);
  35  | 
  36  |     // Wait for the game loop to paint at least one frame
  37  |     await page.waitForFunction(() => {
  38  |       const canvas = document.querySelector('canvas');
  39  |       if (!canvas) return false;
  40  |       const ctx = canvas.getContext('2d');
  41  |       const px = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
  42  |       return px[3] > 0; // alpha > 0 means something was drawn
  43  |     }, { timeout: 5000 });
  44  |   });
  45  | 
  46  |   test('CONFIG object is frozen and exposes expected constants', async ({ page }) => {
  47  |     await page.goto(BASE_URL);
  48  |     await page.waitForTimeout(300);
  49  | 
  50  |     const result = await page.evaluate(() => {
  51  |       const g = window.__game;
  52  |       if (!g) return { ok: false, reason: 'window.__game not exposed' };
  53  |       const C = g.C;
  54  |       if (!C) return { ok: false, reason: 'C is not defined on __game' };
  55  |       if (!Object.isFrozen(C)) return { ok: false, reason: 'C is not frozen' };
  56  | 
  57  |       const required = [
  58  |         'CANVAS_W', 'CANVAS_H',
  59  |         'GRAVITY', 'ASCENT_VELOCITY', 'TERMINAL_VELOCITY',
  60  |         'PIPE_SPEED_INITIAL', 'PIPE_SPEED_MAX', 'PIPE_SPEED_THRESHOLD',
  61  |         'PIPE_GAP', 'PIPE_GAP_MIN_Y', 'PIPE_GAP_MAX_Y',
  62  |         'GHOSTY_W', 'GHOSTY_H', 'HITBOX_INSET',
  63  |         'INVINCIBILITY_MS', 'MAX_DELTA',
  64  |       ];
  65  |       const missing = required.filter(k => !(k in C));
  66  |       if (missing.length) return { ok: false, reason: `Missing keys: ${missing.join(', ')}` };
  67  |       return { ok: true };
  68  |     });
  69  |     expect(result.ok, result.reason).toBe(true);
  70  |   });
  71  | 
  72  |   test('game starts in MENU state', async ({ page }) => {
  73  |     await page.goto(BASE_URL);
  74  |     await page.waitForTimeout(300);
  75  | 
  76  |     const state = await page.evaluate(() => window.__game?.state ?? 'unknown');
  77  |     expect(state).toBe('MENU');
  78  |   });
  79  | 
  80  |   test('game transitions to PLAYING state on Space key', async ({ page }) => {
  81  |     await page.goto(BASE_URL);
  82  |     await page.waitForTimeout(500);
  83  | 
  84  |     const errors = [];
  85  |     page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  86  | 
  87  |     await page.keyboard.press('Space');
  88  |     await page.waitForTimeout(500);
  89  | 
  90  |     const state = await page.evaluate(() => window.__game?.state ?? 'unknown');
  91  |     expect(state).toBe('PLAYING');
  92  |     expect(errors).toHaveLength(0);
  93  |   });
  94  | 
  95  |   test('no console errors on load', async ({ page }) => {
  96  |     const errors = [];
  97  |     const errorUrls = [];
  98  |     page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  99  |     page.on('pageerror', err => errors.push(err.message));
  100 |     page.on('response', res => { if (res.status() === 404) errorUrls.push(res.url()); });
  101 | 
  102 |     await page.goto(BASE_URL);
  103 |     await page.waitForTimeout(1000);
  104 | 
  105 |     // Filter out known external CDN 404s (e.g. Google Fonts in headless)
  106 |     const localErrors = errors.filter(e =>
  107 |       !errorUrls.some(u => isExternalUrl(u) && e.includes('404'))
  108 |     );
  109 | 
> 110 |     expect(localErrors, `Console errors found:\n${localErrors.join('\n')}\n404 URLs: ${errorUrls.join(', ')}`).toHaveLength(0);
      |                                                                                                                ^ Error: Console errors found:
  111 |   });
  112 | 
  113 |   test('no console errors after starting and playing for 2 seconds', async ({ page }) => {
  114 |     const errors = [];
  115 |     page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  116 |     page.on('pageerror', err => errors.push(err.message));
  117 | 
  118 |     await page.goto(BASE_URL);
  119 |     await page.waitForTimeout(300);
  120 | 
  121 |     await page.keyboard.press('Space');
  122 |     await page.waitForTimeout(300);
  123 | 
  124 |     for (let i = 0; i < 6; i++) {
  125 |       await page.keyboard.press('Space');
  126 |       await page.waitForTimeout(300);
  127 |     }
  128 | 
  129 |     expect(errors, `Console errors during gameplay:\n${errors.join('\n')}`).toHaveLength(0);
  130 |   });
  131 | 
  132 |   test('pause and resume works without errors', async ({ page }) => {
  133 |     const errors = [];
  134 |     page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  135 |     page.on('pageerror', err => errors.push(err.message));
  136 | 
  137 |     await page.goto(BASE_URL);
  138 |     await page.waitForTimeout(300);
  139 | 
  140 |     await page.keyboard.press('Space');       // start
  141 |     await page.waitForTimeout(400);
  142 |     await page.keyboard.press('Escape');      // pause
  143 |     await page.waitForTimeout(200);
  144 | 
  145 |     const paused = await page.evaluate(() => window.__game?.state);
  146 |     expect(paused).toBe('PAUSED');
  147 | 
  148 |     await page.keyboard.press('Escape');      // resume
  149 |     await page.waitForTimeout(200);
  150 | 
  151 |     const resumed = await page.evaluate(() => window.__game?.state);
  152 |     expect(resumed).toBe('PLAYING');
  153 | 
  154 |     expect(errors).toHaveLength(0);
  155 |   });
  156 | 
  157 |   test('local assets load without 404 errors', async ({ page }) => {
  158 |     const failed = [];
  159 |     page.on('response', res => {
  160 |       if (res.status() === 404 && !isExternalUrl(res.url())) {
  161 |         failed.push(res.url());
  162 |       }
  163 |     });
  164 | 
  165 |     await page.goto(BASE_URL);
  166 |     await page.waitForTimeout(1000);
  167 | 
  168 |     expect(failed, `404s on local assets: ${failed.join(', ')}`).toHaveLength(0);
  169 |   });
  170 | 
  171 | });
  172 | 
```