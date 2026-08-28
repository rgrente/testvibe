import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page) {
  await page.clock.setFixedTime(new Date("2026-08-28T12:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/visual-fixtures/person-profile");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

test("référence 1d desktop — 1264×730", async ({ page }) => {
  await page.setViewportSize({ width: 1264, height: 730 });
  await openFixture(page);
  const profile = page.getByTestId("person-profile");
  await expect(profile).toBeVisible();
  expect((await profile.boundingBox())?.width).toBe(420);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1264);
  await expect(page).toHaveScreenshot("person-profile-desktop-1264x730.png");
});

test("référence 1d mobile — 390×844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  const profile = page.getByTestId("person-profile");
  await expect(profile).toBeVisible();
  expect((await profile.boundingBox())?.width).toBe(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole("region", { name: "Identité" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Relations" })).toBeVisible();
  await expect(page).toHaveScreenshot("person-profile-mobile-390x844.png");
});
