import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [htmlPath, outputDirectory] = process.argv.slice(2);
if (!htmlPath || !outputDirectory) {
  throw new Error("Usage: node generate-reference-1e.mjs <html-path> <output-directory>");
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.REFERENCE_CHROMIUM_EXECUTABLE || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1, locale: "fr-FR" });
  await page.goto(`${pathToFileURL(path.resolve(htmlPath)).href}#1e`);
  await page.evaluate(() => document.fonts.ready);
  const cards = page.locator("#\\31 e .dv-card");
  const names = ["fan", "statistics", "map", "gedcom", "on-this-day"];
  if (await cards.count() !== names.length) {
    throw new Error(`Expected ${names.length} reference cards, found ${await cards.count()}`);
  }
  for (const [index, name] of names.entries()) {
    await cards.nth(index).screenshot({ path: path.join(outputDirectory, `${name}.png`), animations: "disabled", caret: "initial" });
  }
} finally {
  await browser.close();
}
