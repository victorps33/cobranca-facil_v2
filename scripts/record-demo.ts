import { chromium, type Page } from "playwright";

const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@menlo.com.br";
const PASSWORD = "admin123";

async function safeNav(page: Page, selector: string, waitMs = 3000) {
  try {
    await page.click(selector, { timeout: 5000 });
  } catch {
    console.log(`  ⚠ Selector not found: ${selector}, skipping`);
    return false;
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  } catch {
    // networkidle may not fire if external redirects happen
  }
  await page.waitForTimeout(waitMs);
  // If redirected externally, go back
  if (!page.url().startsWith(BASE_URL)) {
    console.log(`  ⚠ Redirected externally, going back...`);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  }
  return true;
}

async function recordDemo() {
  const browser = await chromium.launch({ headless: false });

  // ── Step 1: Login off-camera ──
  console.log("📍 Logging in (off-camera)...");
  const loginContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const loginPage = await loginContext.newPage();
  await loginPage.goto(`${BASE_URL}/auth/login`);
  await loginPage.waitForLoadState("networkidle");
  await loginPage.waitForTimeout(1000);
  await loginPage.fill("#email", EMAIL);
  await loginPage.fill("#password", PASSWORD);
  await loginPage.click('button[type="submit"]');
  await loginPage.waitForURL((url) => !url.pathname.includes("/auth"), {
    timeout: 20000,
  });
  await loginPage.waitForLoadState("networkidle");
  await loginPage.waitForTimeout(1000);

  const cookies = await loginContext.cookies();
  await loginContext.close();
  console.log("✅ Logged in, cookies saved.");

  // ── Step 2: Record with authenticated session ──
  const recordContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: "./public/videos",
      size: { width: 1440, height: 900 },
    },
  });
  await recordContext.addCookies(cookies);

  const page = await recordContext.newPage();

  // Block external redirects
  await page.route("**/api.contaazul.com/**", (route) => route.abort());

  // ── Dashboard ──
  console.log("📍 Dashboard...");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // ── Cobranças ──
  console.log("📍 Cobranças...");
  await safeNav(page, 'a[href="/cobrancas"]');

  // ── Nova Cobrança ──
  console.log("📍 Nova Cobrança...");
  const clicked = await safeNav(
    page,
    'a[href="/cobrancas/nova"], a:has-text("Nova Cobrança"), button:has-text("Nova")'
  );
  if (clicked) {
    await page.goBack();
    await page.waitForTimeout(1000);
  }

  // ── Réguas ──
  console.log("📍 Réguas...");
  await safeNav(page, 'a[href="/reguas"]');

  // ── CRM ──
  console.log("📍 CRM...");
  await safeNav(page, 'a[href="/crm"]');

  // ── Back to Dashboard ──
  console.log("📍 Dashboard (final)...");
  await safeNav(page, 'a[href="/"]', 2000);

  console.log("✅ Recording complete.");
  await page.close();
  await recordContext.close();
  await browser.close();

  console.log("🎬 Video saved to public/videos/");
}

recordDemo().catch(console.error);
