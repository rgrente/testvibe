import { expect, test, type Locator, type Page } from "@playwright/test";

type Geometry = { x: number; y: number; width: number; height: number };

async function expectGeometry(locator: Locator, reference: Geometry) {
  const actual = await locator.boundingBox();
  expect(actual).not.toBeNull();
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(actual![key] - reference[key]), `${key} de la zone 1d`).toBeLessThanOrEqual(8);
  }
}

// Repères relevés sur la référence 1d de l’archive normative
// SHA-256 64ffe56f2c10c5e9506a4cb338f3d5e2c3f002658e8e87a5257faef14da0056b.
const REFERENCE_1D = {
  desktop: {
    header: { x: 423, y: 84, width: 418, height: 199 },
    identity: { x: 423, y: 283, width: 418, height: 249 },
    relations: { x: 423, y: 532, width: 418, height: 393 },
  },
  mobile: {
    header: { x: 0, y: 0, width: 390, height: 198 },
    identity: { x: 0, y: 198, width: 390, height: 249 },
    relations: { x: 0, y: 447, width: 390, height: 393 },
  },
} satisfies Record<"desktop" | "mobile", Record<string, Geometry>>;

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
  await expectGeometry(profile.locator("header"), REFERENCE_1D.desktop.header);
  await expectGeometry(page.getByRole("region", { name: "Identité" }), REFERENCE_1D.desktop.identity);
  await expectGeometry(page.getByRole("region", { name: "Relations" }), REFERENCE_1D.desktop.relations);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1264);
  await expect(page).toHaveScreenshot("person-profile-desktop-1264x730.png");
});

test("référence 1d mobile — 390×844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  const profile = page.getByTestId("person-profile");
  await expect(profile).toBeVisible();
  await expectGeometry(profile.locator("header"), REFERENCE_1D.mobile.header);
  await expectGeometry(page.getByRole("region", { name: "Identité" }), REFERENCE_1D.mobile.identity);
  await expectGeometry(page.getByRole("region", { name: "Relations" }), REFERENCE_1D.mobile.relations);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole("region", { name: "Identité" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Relations" })).toBeVisible();
  const documentTarget = await page.getByRole("link", { name: "Ouvrir Acte de naissance.pdf" }).boundingBox();
  expect(documentTarget).not.toBeNull();
  expect(documentTarget!.width).toBeGreaterThanOrEqual(44);
  expect(documentTarget!.height).toBeGreaterThanOrEqual(44);
  await expect(page).toHaveScreenshot("person-profile-mobile-390x844.png");
});
