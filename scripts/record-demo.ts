import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@menlo.com.br";
const PASSWORD = "admin123";

async function recordDemo() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: "./public/videos",
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();

  // ── Login ──
  console.log("📍 Logging in...");
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  // Login uses window.location.href redirect, wait for navigation
  await page.waitForURL((url) => !url.pathname.includes("/auth"), {
    timeout: 20000,
  });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // ── Dashboard ──
  console.log("📍 Dashboard...");
  await page.waitForTimeout(3000);

  // ── Cobranças ──
  console.log("📍 Navigating to Cobranças...");
  await page.click('a[href="/cobrancas"], [href="/cobrancas"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // ── Nova Cobrança ──
  console.log("📍 Opening Nova Cobrança...");
  const novaBtn = page.locator('a[href="/cobrancas/nova"], button:has-text("Nova"), a:has-text("Nova")');
  if (await novaBtn.count() > 0) {
    await novaBtn.first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.goBack();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  }

  // ── Réguas ──
  console.log("📍 Navigating to Réguas...");
  await page.click('a[href="/reguas"], [href="/reguas"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // ── CRM ──
  console.log("📍 Navigating to CRM...");
  await page.click('a[href="/crm"], [href="/crm"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // ── Insights ──
  console.log("📍 Navigating to Insights...");
  await page.click('a[href="/insights"], [href="/insights"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // ── Back to Dashboard ──
  console.log("📍 Back to Dashboard...");
  await page.click('a[href="/"], [href="/"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  console.log("✅ Recording complete. Closing...");
  await page.close();
  await context.close();
  await browser.close();

  console.log("🎬 Video saved to public/videos/");
}

recordDemo().catch(console.error);
