import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
// Playwright's own PNG comparator is internal but is the authoritative implementation behind toHaveScreenshot.
// @ts-expect-error Playwright does not publish declarations for this internal comparator.
import * as comparators from "../../../../node_modules/.pnpm/playwright-core@1.51.1/node_modules/playwright-core/lib/server/utils/comparators.js";

const { getComparator } = comparators as unknown as {
  getComparator: (mimeType: string) => (actual: Buffer, expected: Buffer, options: { threshold: number; maxDiffPixelRatio: number }) => { errorMessage: string } | null;
};

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

async function expectAccessibleControl(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  const contract = await control.evaluate((element) => {
    const colorChannels = (color: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const textElement = element.querySelector("text") ?? element;
    const textStyle = getComputedStyle(textElement);
    const foreground = colorChannels(textElement instanceof SVGElement ? textStyle.fill : textStyle.color);
    let backgroundElement: Element | null = element;
    let background = [255, 255, 255, 255];
    while (backgroundElement) {
      const candidate = colorChannels(getComputedStyle(backgroundElement).backgroundColor);
      if (candidate[3] > 0) {
        background = candidate;
        break;
      }
      backgroundElement = backgroundElement.parentElement;
    }
    const foregroundLuminance = luminance(foreground);
    const backgroundLuminance = luminance(background);
    return {
      outline: Number.parseFloat(getComputedStyle(element).outlineWidth),
      height: element.getBoundingClientRect().height,
      contrast: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
    };
  });
  expect(contract.outline).toBeGreaterThanOrEqual(2);
  expect(contract.height).toBeGreaterThanOrEqual(44);
  expect(contract.contrast).toBeGreaterThanOrEqual(4.5);
}

type ReferenceRegion = {
  view: typeof views[number];
  referenceRect: { x: number; y: number; width: number; height: number };
  expectedPadding: number;
  actualHeight?: number;
  capturePadding?: { x: number; y: number };
  surface: (page: Page) => Locator;
};

async function expectReferenceRegion(page: Page, region: ReferenceRegion) {
  const { view, referenceRect, surface: locateSurface, expectedPadding, actualHeight, capturePadding } = region;
  const surface = locateSurface(page);
  const reference = await readFile(`${process.cwd()}/tests/visual/reference-1e/${view}.png`);
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  if (!box) throw new Error(`${view}: zone produit introuvable`);
  const paddingX = capturePadding?.x ?? 0;
  const paddingY = capturePadding?.y ?? 0;
  const actual = actualHeight || capturePadding
    ? await page.screenshot({
      animations: "disabled",
      caret: "initial",
      clip: {
        x: Math.max(0, box.x - paddingX),
        y: Math.max(0, box.y - paddingY),
        width: actualHeight ? Math.min(box.width, referenceRect.width) : Math.min(page.viewportSize()!.width, box.width + (2 * paddingX)),
        height: actualHeight ?? box.height + (2 * paddingY),
      },
    })
    : await surface.screenshot({ animations: "disabled", caret: "initial" });
  const expectedBase64 = await page.evaluate(async ({ referenceUrl, actualUrl, referenceRect: crop, nativeSize }) => {
    const decode = async (url: string) => createImageBitmap(await (await fetch(url)).blob());
    const [expected, received] = await Promise.all([decode(referenceUrl), decode(actualUrl)]);
    const sample = (image: ImageBitmap, source: { x: number; y: number; width: number; height: number }) => {
      const canvas = document.createElement("canvas");
      canvas.width = received.width;
      canvas.height = received.height;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, received.width, received.height);
      return canvas;
    };
    const expectedCanvas = nativeSize
      ? sample(expected, { ...crop, width: received.width, height: received.height })
      : sample(expected, crop);
    return expectedCanvas.toDataURL("image/png").split(",")[1];
  }, {
    referenceUrl: `data:image/png;base64,${reference.toString("base64")}`,
    actualUrl: `data:image/png;base64,${actual.toString("base64")}`,
    referenceRect,
    nativeSize: Boolean(actualHeight),
  });
  const comparison = getComparator("image/png")(actual, Buffer.from(expectedBase64, "base64"), { threshold: 0.2, maxDiffPixelRatio: 0.05 });
  const padding = await surface.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop));
  expect(Math.abs(padding - expectedPadding), `${view}: géométrie structurante (padding) ±8 px`).toBeLessThanOrEqual(8);
  expect(comparison?.errorMessage, `${view}: diff pixel Playwright non masqué de la zone ${referenceRect.width}×${referenceRect.height} intégrale`).toBeUndefined();
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
  await expectAccessibleControl(fanLink);
  await fanLink.press("Enter");
  await expect(page).toHaveURL(/personId=/);

  await openFixture(page, "statistics", 1264, 730);
  await expect(page.getByTestId("statistics-summary").locator("div")).toHaveCount(5);
  await expect(page.getByTestId("statistics-summary")).toContainText("12");
  await expect(page.getByTestId("statistics-summary")).toContainText("3 générations");
  const firstMetric = await page.getByTestId("statistics-summary").locator("div").first().boundingBox();
  expect(firstMetric?.height).toBeGreaterThanOrEqual(72);
  expect(firstMetric?.height).toBeLessThanOrEqual(88);
  await page.goto("/visual-fixtures/secondary?view=statistics&state=empty");
  await expect(page.getByRole("heading", { name: "Aucune donnée familiale" })).toBeVisible();

  await openFixture(page, "map", 390, 844);
  await expectAccessibleControl(page.getByLabel("De", { exact: true }));
  await expectAccessibleControl(page.getByLabel("Personne"));
  await expectAccessibleControl(page.getByRole("button", { name: "Voir sur la carte" }).first());
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
  await expectAccessibleControl(gedcomFile);
  await expect(page.getByRole("link", { name: "Télécharger le fichier .ged" })).toHaveAttribute("href", "/admin/gedcom/export");
  await expectKeyboardFocus(page, "Importer");
  await expectAccessibleControl(page.getByRole("link", { name: "Télécharger le fichier .ged" }));
  await page.getByRole("button", { name: "Importer" }).click();
  expect(await gedcomFile.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
  await page.goto("/visual-fixtures/secondary?view=gedcom&state=error");
  await expect(page.getByRole("alert").filter({ hasText: "Échec de l'import GEDCOM" })).toContainText("Aucune donnée n’a été modifiée");

  await openFixture(page, "on-this-day", 390, 844);
  await expect(page.getByLabel("Parcourir une autre date")).toHaveValue("2026-08-27");
  await expectAccessibleControl(page.getByLabel("Parcourir une autre date"));
  await expect(page.getByRole("link", { name: "Revenir à aujourd’hui" })).toHaveAttribute("href", "/ce-jour-la");
  await expectKeyboardFocus(page, "Afficher");
  await expectAccessibleControl(page.getByRole("link", { name: "Revenir à aujourd’hui" }));
  await expectAccessibleControl(page.getByRole("link", { name: "Union" }));
  await page.goto("/visual-fixtures/secondary?view=on-this-day&state=empty");
  await expect(page.getByText("Aucun anniversaire familial à cette date.")).toBeVisible();
});

const referenceRegions: ReferenceRegion[] = [
  { view: "fan", referenceRect: { x: 0, y: 0, width: 394, height: 39 }, expectedPadding: 20, actualHeight: 39, surface: (page) => page.getByTestId("family-tree-fan-chart") },
  { view: "statistics", referenceRect: { x: 20, y: 70, width: 145, height: 65 }, expectedPadding: 12, surface: (page) => page.getByTestId("statistics-summary").locator(":scope > div").first() },
  { view: "map", referenceRect: { x: 3, y: 248, width: 103, height: 94 }, expectedPadding: 0, capturePadding: { x: 20, y: 40 }, surface: (page) => page.getByTestId("map-location-place").first() },
  { view: "gedcom", referenceRect: { x: 0, y: 0, width: 394, height: 39 }, expectedPadding: 20, actualHeight: 39, surface: (page) => page.getByRole("region", { name: "Importer un fichier GEDCOM" }) },
  { view: "on-this-day", referenceRect: { x: 0, y: 46, width: 392, height: 102 }, expectedPadding: 8, capturePadding: { x: 20, y: 20 }, surface: (page) => page.getByRole("list").first().locator(":scope > li").first() },
];

for (const region of referenceRegions) {
  for (const viewport of [{ width: 1264, height: 730 }, { width: 390, height: 844 }]) {
    test(`pixel-diff 1e traçable — ${region.view} — ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await openFixture(page, region.view, viewport.width, viewport.height);
      await expectReferenceRegion(page, region);
    });
  }
}
