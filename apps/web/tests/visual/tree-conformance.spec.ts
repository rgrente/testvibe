import { expect, test, type Locator, type Page } from "@playwright/test";

type Geometry = { x: number; y: number; width: number; height: number };

async function expectGeometry(locator: Locator, reference: Geometry) {
  const actual = await locator.boundingBox();
  expect(actual).not.toBeNull();
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(actual![key] - reference[key]), `${key} de ${await locator.getAttribute("data-testid") ?? "l’élément"}`).toBeLessThanOrEqual(8);
  }
}

async function openFixture(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/visual-fixtures/tree");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

test("référence 1a — 1264×730", async ({ page }) => {
  await page.setViewportSize({ width: 1264, height: 730 });
  await openFixture(page);
  await page.getByRole("button", { name: "Afficher tout l’arbre" }).click();

  await expect(page.getByTestId("family-tree-canvas-desktop")).toBeVisible();
  await expect(page.getByText("10 personnes")).toBeVisible();
  await expectGeometry(page.getByTestId("family-tree-canvas-desktop"), { x: 0, y: 164, width: 1264, height: 600 });
  await expectGeometry(page.getByRole("button", { name: "Ajuster l’arbre" }), { x: 161, y: 671, width: 73, height: 44 });
  await expect(page).toHaveScreenshot("tree-desktop-1264x730.png");
});

test("référence 1b — 390×844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);

  await expect(page.getByRole("heading", { level: 1, name: "Romain Grente" })).toBeVisible();
  await expect(page.getByText("+2")).toBeVisible();
  await expectGeometry(page.getByRole("heading", { level: 1, name: "Romain Grente" }), { x: 16, y: 175.5, width: 358, height: 21.3 });
  await expectGeometry(page.getByTestId("mobile-generation--1"), { x: 16, y: 302.3, width: 358, height: 151.5 });
  await expectGeometry(page.getByTestId("mobile-siblings"), { x: 16, y: 579.3, width: 358, height: 54.3 });
  await expect(page).toHaveScreenshot("tree-mobile-390x844.png");
});
