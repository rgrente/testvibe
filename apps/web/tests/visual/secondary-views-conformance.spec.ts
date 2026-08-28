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

async function expectKeyboardFocus(page: Page, name: string) {
  const control = page.getByRole("button", { name }).first();
  await control.focus();
  await expect(control).toBeFocused();
  const contract = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    const channels = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const luminance = (rgb: number[]) => rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = luminance(channels(style.color));
    const background = luminance(channels(style.backgroundColor));
    return {
      outline: Number.parseFloat(style.outlineWidth),
      height: element.getBoundingClientRect().height,
      contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
    };
  });
  expect(contract.outline).toBeGreaterThanOrEqual(2);
  expect(contract.height).toBeGreaterThanOrEqual(44);
  expect(contract.contrast).toBeGreaterThanOrEqual(4.5);
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

test("vraies surfaces — interactions, états et accessibilité", async ({ page }) => {
  await openFixture(page, "fan", 390, 844);
  await expect(page.getByRole("button", { name: "Éventail" })).toHaveAttribute("aria-pressed", "true");
  await expectKeyboardFocus(page, "Éventail");
  const fanLink = page.getByTestId("family-tree-fan-chart").getByRole("link").first();
  await fanLink.press("Enter");
  await expect(page).toHaveURL(/personId=/);

  await openFixture(page, "statistics", 1264, 730);
  await expect(page.getByTestId("statistics-summary").locator("div")).toHaveCount(5);
  const firstMetric = await page.getByTestId("statistics-summary").locator("div").first().boundingBox();
  expect(firstMetric?.height).toBeGreaterThanOrEqual(72);
  expect(firstMetric?.height).toBeLessThanOrEqual(88);
  await page.goto("/visual-fixtures/secondary?view=statistics&state=empty");
  await expect(page.getByRole("heading", { name: "Aucune donnée familiale" })).toBeVisible();

  await openFixture(page, "map", 390, 844);
  await page.getByLabel("Personne").selectOption("1");
  await expect(page).toHaveURL(/person=1/);
  await page.getByLabel("De", { exact: true }).fill("1950-01-01");
  await expect(page).toHaveURL(/from=1950-01-01/);
  await page.getByRole("button", { name: "Voir sur la carte" }).first().click();
  await expect(page.getByRole("dialog", { name: /Détail du lieu/ })).toBeVisible();
  await page.goto("/visual-fixtures/secondary?view=map&state=empty");
  await expect(page.getByText("Aucun événement à afficher avec les filtres actuels.")).toBeVisible();

  await openFixture(page, "gedcom", 390, 844);
  const gedcomFile = page.getByLabel("Fichier GEDCOM 5.5.1");
  await expect(gedcomFile).toHaveAttribute("required", "");
  await expect(page.getByRole("link", { name: "Télécharger le fichier .ged" })).toHaveAttribute("href", "/admin/gedcom/export");
  await expectKeyboardFocus(page, "Importer");
  await page.getByRole("button", { name: "Importer" }).click();
  expect(await gedcomFile.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
  await page.goto("/visual-fixtures/secondary?view=gedcom&state=error");
  await expect(page.getByRole("alert").filter({ hasText: "Échec de l'import GEDCOM" })).toContainText("Aucune donnée n’a été modifiée");

  await openFixture(page, "on-this-day", 390, 844);
  await expect(page.getByLabel("Parcourir une autre date")).toHaveValue("2026-08-27");
  await expect(page.getByRole("link", { name: "Revenir à aujourd’hui" })).toHaveAttribute("href", "/ce-jour-la");
  await expectKeyboardFocus(page, "Afficher");
  await page.goto("/visual-fixtures/secondary?view=on-this-day&state=empty");
  await expect(page.getByText("Aucun anniversaire familial à cette date.")).toBeVisible();
});
