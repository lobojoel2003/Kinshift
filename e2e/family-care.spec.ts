import fs from "node:fs";
import path from "node:path";
import { expect, test, devices, type Browser, type Page } from "@playwright/test";

/**
 * One family's story, end to end: the first organizer sets Kinshift up, adds
 * medications, invites a sibling, and both of them use it at the same time.
 */

test.describe.configure({ mode: "serial" });

const OWNER = { name: "Joel Lobo", email: "joel@example.com", password: "a long caring sentence" };
const SIBLING = {
  name: "Priya Lobo",
  email: "priya@example.com",
  password: "another caring sentence",
};
const VIEWER = {
  name: "Aunt Rosa",
  email: "rosa@example.com",
  password: "rosa reads along nicely",
};
const dataDir = path.resolve(process.cwd(), "e2e", ".data");

let circleUrl = "";
let caregiverInvite = "";

/** "HH:MM" for the current UTC time; the test circle uses the browser's UTC zone. */
function nowHHMM(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return d.toISOString().slice(11, 16);
}

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/c\//);
}

async function newUserPage(browser: Browser) {
  const context = await browser.newContext({ timezoneId: "UTC", locale: "en-US" });
  return context.newPage();
}

test("the first visitor sets up Kinshift and a care circle", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Share the care/ })).toBeVisible();
  await page.getByRole("link", { name: "Set up your family" }).click();
  await expect(page).toHaveURL(/\/signup$/);

  await page.getByLabel("Your name").fill(OWNER.name);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();

  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding$/);

  await page.getByLabel("Who are you caring for?").fill("Mom");
  await page.getByLabel(/Your relationship/).fill("Son");
  await page.getByRole("button", { name: "Create care circle" }).click();
  await page.waitForURL(/\/c\/[\w-]+\?welcome=1/);
  circleUrl = page.url().split("?")[0];

  await expect(page.getByText("Your care circle for Mom is ready")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Get set up" })).toBeVisible();
});

test("new accounts need an invite once the server is set up", async ({ browser }) => {
  const page = await newUserPage(browser);
  await page.goto("/signup");
  await expect(page.getByText("Invite needed")).toBeVisible();
  await page.context().close();
});

test("an organizer adds medications and logs a dose", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto(`${circleUrl}/meds/new`);
  await page.locator("#name").fill("Metformin");
  await page.locator("#dosage").fill("500 mg");
  await page.getByLabel("Dose time 1").fill(nowHHMM());
  await page.getByLabel(/On hand now/).fill("20");
  await page.getByRole("button", { name: "Add medication" }).click();
  await expect(page.getByText("Metformin added")).toBeVisible();

  await page.goto(`${circleUrl}/meds/new`);
  await page.locator("#name").fill("Lisinopril");
  await page.locator("#dosage").fill("10 mg");
  await page.getByLabel("Dose time 1").fill(nowHHMM());
  await page.getByRole("button", { name: "Add medication" }).click();
  await expect(page.getByText("Lisinopril added")).toBeVisible();

  const row = page.getByTestId("dose-row").filter({ hasText: "Metformin" });
  await expect(row).toHaveAttribute("data-state", "due");
  await row.getByRole("button", { name: "Given" }).click();
  await expect(row).toContainText("Given by Joel");
  await expect(page.getByTestId("med-card").filter({ hasText: "Metformin" })).toContainText(
    "19 on hand",
  );
});

test("the organizer invites a sibling who joins from the link", async ({ page, browser }) => {
  await signIn(page, OWNER);
  await page.goto(`${circleUrl}/family`);
  await page.getByRole("button", { name: "Create invite link" }).click();
  caregiverInvite = await page.getByLabel("Invite link").inputValue();
  expect(caregiverInvite).toContain("/invite/");

  const sibling = await newUserPage(browser);
  await sibling.goto(caregiverInvite);
  await expect(sibling.getByRole("heading", { name: /Joel Lobo invited you/ })).toBeVisible();
  await sibling.getByLabel("Your name").fill(SIBLING.name);
  await sibling.getByLabel("Email").fill(SIBLING.email);
  await sibling.getByLabel("Password").fill(SIBLING.password);
  await sibling.getByRole("button", { name: "Create account and join" }).click();
  await sibling.waitForURL(/\/c\/.*joined=1/);
  await expect(sibling.getByText("Welcome to Caring for Mom")).toBeVisible();
  await sibling.context().close();

  await page.reload();
  await expect(page.getByTestId("member-row")).toHaveCount(2);
});

test("two siblings cannot give the same dose twice", async ({ page, browser }) => {
  await signIn(page, OWNER);
  const sibling = await newUserPage(browser);
  await signIn(sibling, SIBLING);

  // Both open the checklist while the Lisinopril dose is still open.
  await page.goto(`${circleUrl}/meds`);
  await sibling.goto(`${circleUrl}/meds`);
  const ownerRow = page.getByTestId("dose-row").filter({ hasText: "Lisinopril" });
  const siblingRow = sibling.getByTestId("dose-row").filter({ hasText: "Lisinopril" });
  await expect(siblingRow.getByRole("button", { name: "Given" })).toBeEnabled();

  await ownerRow.getByRole("button", { name: "Given" }).click();
  await expect(ownerRow).toContainText("Given by Joel");

  // The sibling's screen is stale; the server still refuses the duplicate.
  await siblingRow.getByRole("button", { name: "Given" }).click();
  await expect(sibling.getByText(/Already given by Joel Lobo/)).toBeVisible();
  await expect(siblingRow).toContainText("Given by Joel");
  await sibling.context().close();
});

test("clashing appointments need confirmation", async ({ page }) => {
  await signIn(page, OWNER);
  for (const [title, start, end] of [
    ["Cardiology follow-up", "10:00", "11:00"],
    ["Blood test", "10:30", "11:15"],
  ]) {
    await page.goto(`${circleUrl}/appointments/new`);
    await page.getByLabel("What is it?").fill(title);
    await page.getByLabel("Starts").fill(start);
    await page.getByLabel("Ends").fill(end);
    await page.getByRole("button", { name: "Add appointment" }).click();
  }
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("This overlaps another appointment");
  await expect(dialog).toContainText("Cardiology follow-up");
  await dialog.getByRole("button", { name: "Save anyway" }).click();
  await page.waitForURL(/\/appointments\/[\w-]+\?saved=1/);
  await expect(page.getByText("This clashes with another appointment")).toBeVisible();
});

test("a caregiver covers an uncovered stretch from the schedule", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto(
    `${circleUrl}/schedule?week=${new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)}`,
  );
  const gaps = page.getByTestId("gap-item");
  const before = await gaps.count();
  expect(before).toBeGreaterThan(0);
  await gaps.first().getByRole("button", { name: "I’ll cover" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "I’ll cover it" }).click();
  await expect(page.getByText(/You’re covering/)).toBeVisible();
  await expect(gaps).toHaveCount(before - 1);
  await expect(page.getByTestId("shift-item").first()).toContainText("You");
});

test("journal entries are encrypted before they reach the disk", async ({ page }) => {
  await signIn(page, OWNER);
  const secret = `Mom mentioned chest tightness ${Date.now()}`;
  await page.goto(`${circleUrl}/journal`);
  await page.getByLabel("Handoff for the next person").fill(secret);
  await page.getByRole("button", { name: "Share handoff" }).click();
  await expect(page.getByTestId("journal-entry").first()).toContainText(secret);

  const files = fs.readdirSync(dataDir).filter((f) => f.startsWith("kinshift.db"));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const bytes = fs.readFileSync(path.join(dataDir, f));
    expect(bytes.includes(Buffer.from(secret)), `${f} contains plaintext`).toBe(false);
    expect(bytes.includes(Buffer.from("Metformin")), `${f} contains plaintext`).toBe(false);
  }
});

test("viewers can read but not change anything", async ({ page, browser }) => {
  await signIn(page, OWNER);
  await page.goto(`${circleUrl}/family`);
  await page.getByLabel("They can").selectOption("viewer");
  await page.getByRole("button", { name: "Create invite link" }).click();
  const invite = await page.getByLabel("Invite link").inputValue();

  const viewer = await newUserPage(browser);
  await viewer.goto(invite);
  await viewer.getByLabel("Your name").fill(VIEWER.name);
  await viewer.getByLabel("Email").fill(VIEWER.email);
  await viewer.getByLabel("Password").fill(VIEWER.password);
  await viewer.getByRole("button", { name: "Create account and join" }).click();
  await viewer.waitForURL(/\/c\//);

  await viewer.goto(`${circleUrl}/meds`);
  await expect(viewer.getByTestId("dose-row").first()).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Given" })).toHaveCount(0);
  await expect(viewer.getByRole("link", { name: "Add medication" })).toHaveCount(0);
  await viewer.goto(`${circleUrl}/meds/new`);
  await expect(viewer).toHaveURL(new RegExp(`${circleUrl.split("/c/")[1]}$`));
  await viewer.context().close();
});

test("pages are protected and send security headers", async ({ browser, request }) => {
  const anon = await newUserPage(browser);
  await anon.goto(circleUrl);
  await expect(anon).toHaveURL(/\/login$/);
  await anon.context().close();

  const res = await request.get("/login");
  const csp = res.headers()["content-security-policy"];
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(res.headers()["x-frame-options"]).toBe("DENY");

  const health = await request.get("/api/health");
  expect(await health.json()).toMatchObject({ status: "ok" });

  const stranger = await newUserPage(browser);
  await signIn(stranger, SIBLING);
  const notMine = await stranger.goto("/c/this-circle-does-not-exist");
  expect(notMine?.status()).toBe(404);
  await stranger.context().close();
});

test("works on a phone with the bottom navigation", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"], timezoneId: "UTC" });
  const page = await context.newPage();
  await signIn(page, SIBLING);
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Schedule" }).click();
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await nav.getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("link", { name: "Emergency card" })).toBeVisible();
  await context.close();
});
