// Regenerates the README screenshots in docs/images.
//
//   DATA_DIR=./demo-data KINSHIFT_DEMO_TZ=Asia/Bangkok npm run db:seed-demo
//   npm run build && DATA_DIR=./demo-data PORT=3000 node .next/standalone/server.js
//   BASE_URL=http://localhost:3000 npm run screenshots
//
// Pick a KINSHIFT_DEMO_TZ where it is around lunchtime so the checklist shows
// doses given, due and coming up.
import path from "node:path";
import { chromium, devices } from "@playwright/test";
import sharp from "sharp";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = path.resolve(import.meta.dirname, "..", "docs", "images");
const browser = await chromium.launch();

async function signedIn(options, email = "maya@example.com") {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("kinshift-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/c\//);
  return { context, page, circle: page.url().split("?")[0] };
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

const desktop = {
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: "light",
};

// Landing page, signed out.
{
  const context = await browser.newContext(desktop);
  const page = await context.newPage();
  await page.goto(base);
  await settle(page);
  await page.screenshot({ path: path.join(out, "landing.png") });
  await context.close();
}

// Desktop screens.
{
  const { context, page, circle } = await signedIn(desktop);
  const shots = [
    ["today.png", ""],
    ["schedule.png", "/schedule"],
    ["medications.png", "/meds"],
    ["journal.png", "/journal"],
    ["care-profile.png", "/profile"],
  ];
  for (const [file, route] of shots) {
    await page.goto(circle + route);
    await settle(page);
    await page.screenshot({ path: path.join(out, file) });
  }
  await context.close();
}

// Dark mode.
{
  const { context, page } = await signedIn({ ...desktop, colorScheme: "dark" });
  await settle(page);
  await page.screenshot({ path: path.join(out, "today-dark.png") });
  await context.close();
}

// Phones: three screens side by side in one image.
{
  const phone = { ...devices["iPhone 14"], deviceScaleFactor: 2 };
  const { context, page, circle } = await signedIn(phone, "daniel@example.com");
  const frames = [];
  for (const route of ["", "/meds", "/schedule"]) {
    await page.goto(circle + route);
    await settle(page);
    frames.push(await page.screenshot());
  }
  await context.close();

  const { width, height } = await sharp(frames[0]).metadata();
  const gap = 48;
  const pad = 64;
  const rounded = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="56" ry="56"/></svg>`,
  );
  const phones = await Promise.all(
    frames.map((f) =>
      sharp(f)
        .composite([{ input: rounded, blend: "dest-in" }])
        .png()
        .toBuffer(),
    ),
  );
  await sharp({
    create: {
      width: pad * 2 + width * 3 + gap * 2,
      height: pad * 2 + height,
      channels: 4,
      background: { r: 230, g: 244, b: 241, alpha: 1 },
    },
  })
    .composite(phones.map((input, i) => ({ input, left: pad + i * (width + gap), top: pad })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, "mobile.png"));
}

await browser.close();
console.log(`Screenshots written to ${out}`);
