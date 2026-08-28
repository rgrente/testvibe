import { expect, test, type Page } from "@playwright/test";

const views = ["fan", "statistics", "map", "gedcom", "on-this-day"] as const;

async function openFixture(page: Page, view: typeof views[number], width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (view === "map") await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 204 }));
  const response = await page.goto(`/visual-fixtures/secondary?view=${view}`);
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  if (view === "map") await expect(page.locator(".leaflet-marker-pane > *")).toHaveCount(3);
}

for (const view of views) {
  test(`référence 1e — ${view} — 1264×730`, async ({ page }) => {
    await openFixture(page, view, 1264, 730);
    await expect(page.getByTestId(`secondary-${view}`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1264);
    await expect(page).toHaveScreenshot(`secondary-${view}-desktop-1264x730.png`);
  });

  test(`référence 1e — ${view} — 390×844`, async ({ page }) => {
    await openFixture(page, view, 390, 844);
    await expect(page.getByTestId(`secondary-${view}`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page).toHaveScreenshot(`secondary-${view}-mobile-390x844.png`);
  });
}
