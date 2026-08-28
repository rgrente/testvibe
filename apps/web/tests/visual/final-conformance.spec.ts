import { expect, test, type Page } from "@playwright/test";

const SHA_256 = "64ffe56f2c10c5e9506a4cb338f3d5e2c3f002658e8e87a5257faef14da0056b";

const views = [
  ["1a/1b arbre", "/visual-fixtures/tree"],
  ["1c timeline", "/visual-fixtures/timeline"],
  ["1d fiche personne", "/visual-fixtures/person-profile"],
  ["1e éventail", "/visual-fixtures/secondary?view=fan"],
  ["1e statistiques", "/visual-fixtures/secondary?view=statistics"],
  ["1e carte", "/visual-fixtures/secondary?view=map"],
  ["1e GEDCOM", "/visual-fixtures/secondary?view=gedcom"],
  ["1e ce jour-là", "/visual-fixtures/secondary?view=on-this-day"],
] as const;

const viewports = [
  { label: "desktop", width: 1264, height: 730 },
  { label: "mobile", width: 390, height: 844 },
] as const;

async function openReducedMotion(page: Page, path: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (path.includes("view=map")) {
    await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 204 }));
  }
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

async function auditDocument(page: Page, viewportWidth: number) {
  return page.evaluate(({ width, archive }) => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const parseDurations = (value: string) => value.split(",").map((duration) => {
      const trimmed = duration.trim();
      return trimmed.endsWith("ms") ? Number.parseFloat(trimmed) : Number.parseFloat(trimmed) * 1000;
    });
    const controls = [...document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.closest("nextjs-portal"))
      .filter((element) => !element.matches(":disabled") && element.getAttribute("aria-label") !== "Open Next.js Dev Tools")
      .filter(visible);
    const unnamed = controls.filter((element) => {
      const id = element.id;
      const labelled = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const wrappingLabel = element.closest("label");
      const name = element.getAttribute("aria-label")
        ?? (element.getAttribute("aria-labelledby") ? "labelled" : null)
        ?? labelled?.textContent
        ?? wrappingLabel?.textContent
        ?? element.getAttribute("alt")
        ?? element.querySelector("img[alt]")?.getAttribute("alt")
        ?? element.getAttribute("title")
        ?? element.textContent
        ?? (element instanceof HTMLInputElement ? element.value : "");
      return !name?.trim();
    }).map((element) => element.outerHTML.slice(0, 160));
    const undersized = controls.filter((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.width >= 24 && rect.height >= 24) return false;
      const center = { x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) };
      return controls.some((other, otherIndex) => {
        if (index === otherIndex) return false;
        const otherRect = other.getBoundingClientRect();
        const otherCenter = { x: otherRect.left + (otherRect.width / 2), y: otherRect.top + (otherRect.height / 2) };
        return Math.abs(center.x - otherCenter.x) < 24 && Math.abs(center.y - otherCenter.y) < 24;
      });
    }).map((element) => {
      const rect = element.getBoundingClientRect();
      return `${element.tagName.toLowerCase()} ${element.getAttribute("aria-label") ?? element.textContent?.trim() ?? ""} (${Math.round(rect.width)}×${Math.round(rect.height)})`;
    });
    const motion = [...document.querySelectorAll<HTMLElement>("body *")].filter(visible).filter((element) => {
      const style = getComputedStyle(element);
      return [...parseDurations(style.animationDuration), ...parseDurations(style.transitionDuration)].some((duration) => duration > 0);
    }).map((element) => `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 160));

    return {
      archive,
      mains: document.querySelectorAll("main").length,
      headings: [...document.querySelectorAll("h1")].filter(visible).length,
      overflow: document.body.getBoundingClientRect().width - width,
      overflowGuard: ["hidden", "clip"].includes(getComputedStyle(document.body).overflowX),
      unnamed,
      undersized,
      motion,
      controls: controls.length,
    };
  }, { width: viewportWidth, archive: SHA_256 });
}

async function auditFocus(page: Page) {
  const controls = page.locator("a[href]:visible, button:visible, input:not([type=hidden]):visible, select:visible, textarea:visible, [tabindex]:not([tabindex='-1']):visible");
  const count = await controls.count();
  const failures: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (await control.evaluate((element) => Boolean(element.closest("nextjs-portal"))
      || element.matches(":disabled")
      || element.getAttribute("aria-label") === "Open Next.js Dev Tools")) continue;
    await control.focus();
    const focus = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        active: document.activeElement === element,
        indicator: Number.parseFloat(style.outlineWidth) >= 2 || (style.boxShadow !== "none" && style.boxShadow !== ""),
        label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
      };
    });
    if (!focus.active || !focus.indicator) failures.push(focus.label.slice(0, 80));
  }
  return failures;
}

async function auditContrast(page: Page) {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const rgba = (value: string): Rgba => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha / 255];
    };
    const composite = (front: Rgba, back: Rgba): Rgba => {
      const alpha = front[3] + (back[3] * (1 - front[3]));
      if (alpha === 0) return [0, 0, 0, 0];
      return [0, 1, 2, 3].map((index) => index === 3
        ? alpha
        : ((front[index] * front[3]) + (back[index] * back[3] * (1 - front[3]))) / alpha) as Rgba;
    };
    const background = (element: Element) => {
      let current: Element | null = element;
      let result: Rgba = [255, 255, 255, 1];
      while (current) {
        const candidate = rgba(getComputedStyle(current).backgroundColor);
        if (candidate[3] > 0) {
          result = composite(candidate, result);
          if (candidate[3] === 1) break;
        }
        current = current.parentElement;
      }
      return result;
    };
    const luminance = (color: Rgba) => color.slice(0, 3).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return [...document.querySelectorAll<HTMLElement>("body *")].filter((element) => {
      if (element.closest("nextjs-portal, [aria-hidden='true']")) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const hasText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      return hasText && rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
    }).flatMap((element) => {
      const style = getComputedStyle(element);
      const back = background(element);
      const front = composite(rgba(element instanceof SVGElement ? style.fill : style.color), back);
      const light = Math.max(luminance(front), luminance(back));
      const dark = Math.min(luminance(front), luminance(back));
      const ratio = (light + 0.05) / (dark + 0.05);
      const size = Number.parseFloat(style.fontSize);
      const bold = Number.parseInt(style.fontWeight, 10) >= 700;
      const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      if (ratio + 0.01 >= required) return [];
      return [`${element.textContent?.trim().slice(0, 60)} (${ratio.toFixed(2)}:1 < ${required}:1)`];
    });
  });
}

for (const [view, path] of views) {
  for (const viewport of viewports) {
    test(`${view} — audit WCAG transversal ${viewport.label}`, async ({ page }) => {
      await openReducedMotion(page, path, viewport.width, viewport.height);
      const audit = await auditDocument(page, viewport.width);
      expect(audit.archive).toBe(SHA_256);
      expect(audit.mains, "un unique landmark main visible").toBe(1);
      expect(audit.headings, "un unique titre h1 visible").toBe(1);
      expect(audit.overflow, "aucun débordement horizontal du document").toBeLessThanOrEqual(0);
      expect(audit.overflowGuard, "le débordement horizontal reste borné au composant scrollable").toBe(true);
      expect(audit.controls, "au moins un contrôle clavier réel").toBeGreaterThan(0);
      expect(audit.unnamed, "rôles interactifs avec nom accessible").toEqual([]);
      expect(audit.undersized, "cibles WCAG 2.5.8 de 24×24 px ou espacement équivalent").toEqual([]);
      expect(audit.motion, "aucune animation sous prefers-reduced-motion").toEqual([]);
      expect(await auditContrast(page), "contraste du texte WCAG AA").toEqual([]);
      expect(await auditFocus(page), "focus visible d’au moins 2 px sur chaque contrôle").toEqual([]);
    });
  }
}
