// Automated screenshot capture for the training book.
// Boots a headless Chromium at mobile viewport, logs in as Majdi + Emp,
// walks every major screen, captures PNGs into docs/screenshots/.
//
// USAGE (PowerShell):
//   $env:MAJDI_PASSWORD="your-password-here"
//   $env:EMP_PASSWORD="your-password-here"
//   node scripts/take-screenshots.mjs
//
// Optional env vars:
//   BASE_URL      = "http://localhost:3001"   (defaults to localhost:3001)
//   MAJDI_EMAIL   = "majdi@alqasr.test"       (defaults to the seed admin)
//   EMP_EMAIL     = "emp@alqasr.test"         (defaults to the seed employee)
//
// REQUIREMENTS:
//   - Dev server running (`npm run dev`)
//   - Year of training data seeded (`npx supabase db push` after migration 0007)

import { chromium, devices } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.resolve(__dirname, "../docs/screenshots");

const BASE        = process.env.BASE_URL    || "http://localhost:3001";
const MAJDI_EMAIL = process.env.MAJDI_EMAIL || "majdi@alqasr.test";
const MAJDI_PASS  = process.env.MAJDI_PASSWORD;
const EMP_EMAIL   = process.env.EMP_EMAIL   || "emp@alqasr.test";
const EMP_PASS    = process.env.EMP_PASSWORD;

if (!MAJDI_PASS || !EMP_PASS) {
  console.error("\n❌ Missing credentials. Set them in PowerShell:");
  console.error('   $env:MAJDI_PASSWORD = "..."');
  console.error('   $env:EMP_PASSWORD   = "..."');
  console.error('Then re-run: node scripts/take-screenshots.mjs\n');
  process.exit(1);
}

await fs.mkdir(OUT_DIR, { recursive: true });
console.log(`📂 Output: ${OUT_DIR}`);
console.log(`🌐 Base:   ${BASE}\n`);

const browser = await chromium.launch({ headless: true });

const phone = {
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  locale: "ar-PS",
  timezoneId: "Asia/Jerusalem",
};

let success = 0, failed = 0;

async function shoot(label, fn) {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  try {
    await fn(page);
    const out = path.join(OUT_DIR, `${label}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`✓ ${label}.png`);
    success++;
  } catch (e) {
    console.error(`✗ ${label} — ${e.message?.split("\n")[0]}`);
    failed++;
  } finally {
    await ctx.close();
  }
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

async function findFirstHrefMatching(page, listUrl, pattern) {
  await page.goto(`${BASE}${listUrl}`, { waitUntil: "networkidle" });
  const hrefs = await page.$$eval("a[href]", (els) => els.map((a) => a.getAttribute("href")));
  return hrefs.find((h) => h && pattern.test(h));
}

// =====================================================
// LOGIN (no auth needed)
// =====================================================
await shoot("01-login", async (page) => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
});

// =====================================================
// ADMIN — MAJDI
// =====================================================
await shoot("02-admin-dashboard-monthly", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/dashboard?period=monthly`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // chart animations
});

await shoot("03-admin-dashboard-weekly", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/dashboard?period=weekly`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
});

await shoot("04-admin-more-sheet", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("المزيد")');
  await page.waitForTimeout(400);
});

await shoot("05-admin-clients-list", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

const adminClientHref = await (async () => {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  const h = await findFirstHrefMatching(page, "/clients", /^\/clients\/[0-9a-f-]{36}$/);
  await ctx.close();
  return h;
})();

await shoot("06-admin-client-edit", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  if (!adminClientHref) throw new Error("no client found");
  await page.goto(`${BASE}${adminClientHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
});

await shoot("07-admin-client-new", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/clients/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.fill('input[placeholder*="عرّابة"]', "عرّابة، الحارة الغربية مقابل صيدلية الشفاء");
  await page.waitForTimeout(300);
});

await shoot("08-admin-merge-wizard", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/clients/merge`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
});

await shoot("09-admin-products-list", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

const productHref = await (async () => {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  const h = await findFirstHrefMatching(page, "/products", /^\/products\/[0-9a-f-]{36}$/);
  await ctx.close();
  return h;
})();

await shoot("10-admin-product-edit", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  if (!productHref) throw new Error("no product found");
  await page.goto(`${BASE}${productHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await shoot("11-admin-product-new", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/products/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
});

await shoot("12-admin-expenses-list", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/expenses`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await shoot("13-admin-expense-new", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/expenses/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
});

await shoot("14-admin-production-list", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/production`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await shoot("15-admin-production-new", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/production/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
});

await shoot("16-admin-users-list", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/users`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
});

await shoot("17-admin-user-new", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/users/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
});

await shoot("18-admin-reports", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
});

await shoot("19-admin-inventory", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/inventory?period=monthly`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
});

await shoot("20-admin-export", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/export`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
});

await shoot("21-admin-ai-empty", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/ai`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
});

await shoot("22-admin-ai-with-history-drawer", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/ai`, { waitUntil: "networkidle" });
  // Seed a question to populate a chat
  await page.evaluate(() => {
    const chats = [{
      id: "demo",
      title: "كم بعت لبن هذا الشهر؟",
      messages: [
        { id: "u1", role: "user",      text: "كم بعت لبن هذا الشهر؟" },
        { id: "a1", role: "assistant", text: "بعت 247 لتر لبن خلال آخر شهر بإجمالي 1,235 ₪. ارتفاع 18% عن الشهر السابق 📈", provider: "gemini" },
      ],
      updatedAt: Date.now(),
    }];
    localStorage.setItem("ai-chats-v2", JSON.stringify(chats));
  });
  await page.goto(`${BASE}/ai`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.click('button:has-text("السجل")');
  await page.waitForTimeout(400);
});

await shoot("23-admin-activity-feed", async (page) => {
  await login(page, MAJDI_EMAIL, MAJDI_PASS);
  await page.goto(`${BASE}/activity`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
});

// =====================================================
// EMPLOYEE — EMP
// =====================================================
await shoot("30-emp-clients-home", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
});

const empClientHref = await (async () => {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await login(page, EMP_EMAIL, EMP_PASS);
  const h = await findFirstHrefMatching(page, "/", /^\/client\/[0-9a-f-]{36}$/);
  await ctx.close();
  return h;
})();

await shoot("31-emp-client-detail", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  if (!empClientHref) throw new Error("no client found for emp");
  await page.goto(`${BASE}${empClientHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
});

await shoot("32-emp-client-quick-add", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  await page.goto(`${BASE}/client/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
});

const visitClientId = empClientHref ? empClientHref.replace("/client/", "") : null;

await shoot("33-emp-visit-new-empty", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  if (!visitClientId) throw new Error("no client id");
  await page.goto(`${BASE}/visit/new?client=${visitClientId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
});

await shoot("34-emp-visit-picker-sale", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  if (!visitClientId) throw new Error("no client id");
  await page.goto(`${BASE}/visit/new?client=${visitClientId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("بيع جديد")');
  await page.waitForTimeout(400);
});

await shoot("35-emp-visit-with-lines", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  if (!visitClientId) throw new Error("no client id");
  await page.goto(`${BASE}/visit/new?client=${visitClientId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Add a sale line via the picker
  await page.click('button:has-text("بيع جديد")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("لبن")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("إضافة إلى الزيارة")');
  await page.waitForTimeout(500);
  // Add a return line
  await page.click('button:has-text("مرتجع تالف")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("لبن")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("إضافة إلى الزيارة")');
  await page.waitForTimeout(600);
});

const visitHref = await (async () => {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await login(page, EMP_EMAIL, EMP_PASS);
  const h = await findFirstHrefMatching(page, "/my-visits", /^\/visit\/[0-9a-f-]{36}$/);
  await ctx.close();
  return h;
})();

await shoot("36-emp-receipt", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  if (!visitHref) throw new Error("no visit for emp");
  await page.goto(`${BASE}${visitHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
});

await shoot("37-emp-my-visits", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  await page.goto(`${BASE}/my-visits`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
});

await shoot("38-emp-profile", async (page) => {
  await login(page, EMP_EMAIL, EMP_PASS);
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
});

await browser.close();

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✅ Captured: ${success} screenshots`);
if (failed > 0) console.log(`❌ Failed:   ${failed}`);
console.log(`📂 Saved to: ${OUT_DIR}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
