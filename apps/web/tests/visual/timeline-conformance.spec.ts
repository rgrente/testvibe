import { expect, test, type Locator, type Page } from "@playwright/test";

type Geometry = { width: number; height: number };

async function expectSize(locator: Locator, reference: Geometry) {
  const actual = await locator.boundingBox();
  expect(actual).not.toBeNull();
  expect(Math.abs(actual!.width - reference.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual!.height - reference.height)).toBeLessThanOrEqual(1);
}

async function openFixture(page: Page) {
  await page.clock.setFixedTime(new Date("2026-08-28T12:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/visual-fixtures/timeline");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

test("référence 1c — 1000×730", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 730 });
  await openFixture(page);
  await expect(page.getByText("1960 → 2030 · 12 personnes · 27 événements")).toBeVisible();
  await expectSize(page.getByTestId("timeline-person-column"), { width: 158, height: 36 });
  await expectSize(page.getByTestId("timeline-person-1"), { width: 158, height: 36 });
  await expect(page).toHaveScreenshot("timeline-desktop-1000x730.png");
});

test("adaptation mobile — 390×844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  await expect(page.getByTestId("timeline-scroll")).toBeVisible();
  await expectSize(page.getByTestId("timeline-person-column"), { width: 158, height: 36 });
  await expect(page.getByRole("button", { name: "Générations" })).toBeVisible();
  await expect(page).toHaveScreenshot("timeline-mobile-390x844.png");
});
