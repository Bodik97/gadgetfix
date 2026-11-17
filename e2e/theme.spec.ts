import { expect, test } from "@playwright/test";
import { lowContrastTexts } from "./helpers/contrast";

/**
 * Світла й темна тема: перемикач працює й запамʼятовує вибір, тема стоїть
 * ще до гідратації, і жоден текст на жодній сторінці не губиться на тлі.
 */

test("перемикач: типово світла, вибір темної переживає перезавантаження, логотип графітовий", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const html = page.locator("html");
  // Типова тема — світла (layout.tsx)
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Світла / темна тема" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload({ waitUntil: "networkidle" });
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Світла / темна тема" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload({ waitUntil: "networkidle" });
  await expect(html).toHaveAttribute("data-theme", "light");
  // Шапка темна в обох темах — логотип там без плашки
  await expect(page.locator("header")).toHaveAttribute("data-theme", "dark");
  const plate = (sel: string) =>
    page.locator(sel).evaluate((img) => getComputedStyle(img.parentElement!).backgroundColor);
  expect(await plate('header img[src$="gadgetfix-logo-dark.svg"]')).toBe("rgba(0, 0, 0, 0)");
  // …а на світлому підвалі кольори логотипа ті самі, на графітовій плашці
  expect(await plate('footer img[src$="gadgetfix-logo-dark.svg"]')).toBe("rgb(17, 19, 17)");

  await page.getByRole("button", { name: "Світла / темна тема" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("тема стоїть на <html> ще до гідратації — без спалаху темної", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gf-theme", "light"));
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __themeAtDcl: string | null }).__themeAtDcl =
        document.documentElement.getAttribute("data-theme");
    });
  });
  await page.goto("/");
  expect(await page.evaluate(() => (window as unknown as { __themeAtDcl: string | null }).__themeAtDcl)).toBe("light");
});

const PAGES = ["/", "/poslugy", "/poslugy/zamina-ekrana", "/modeli", "/modeli/iphone-16-pro-max", "/android", "/planshety", "/godynnyky", "/poshtoyu", "/personalni-dani", "/vhid"];

for (const theme of ["dark", "light"] as const) {
  test(`контраст тексту — ${theme === "light" ? "світла" : "темна"} тема`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((t) => localStorage.setItem("gf-theme", t), theme);
    const problems: string[] = [];
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: "networkidle" });
      for (const p of await page.evaluate(lowContrastTexts)) problems.push(`${path}: ${p}`);
    }
    expect(problems).toEqual([]);
  });
}

test("контраст у світлій темі — адмінка", async ({ page }) => {
  test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, "немає облікових даних майстра");
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("gf-theme", "light"));
  await page.goto("/admin/vhid");
  await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin$/);

  const problems: string[] = [];
  for (const path of ["/admin", "/admin/zayavky", "/admin/arhiv", "/admin/sklad", "/admin/kliyenty", "/admin/vidhuky", "/admin/groshi", "/admin/nova"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    for (const p of await page.evaluate(lowContrastTexts)) problems.push(`${path}: ${p}`);
  }
  expect(problems).toEqual([]);
});
