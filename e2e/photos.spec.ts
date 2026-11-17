import { expect, test } from "@playwright/test";

/**
 * Фото телефонів видно повністю — вписані в рамку, не обрізані. Окремо
 * важливо для Safari: він не рахує max-height: 100% у блоці з aspect-ratio,
 * і фото на сторінці моделі показувалось завеликим, обрізаним рамкою.
 * Тому цей файл ганяється ще й у проєкті «safari» (WebKit).
 */

const inside = (img: HTMLImageElement) => {
  const b = img.getBoundingClientRect();
  const box = img.parentElement!.getBoundingClientRect();
  return b.width > 0 && b.top >= box.top - 0.5 && b.bottom <= box.bottom + 0.5 && b.left >= box.left - 0.5 && b.right <= box.right + 0.5;
};

for (const slug of ["iphone-13", "iphone-16-pro-max"]) {
  test(`сторінка моделі ${slug}: фото повністю в рамці`, async ({ page }) => {
    await page.goto(`/modeli/${slug}`, { waitUntil: "networkidle" });
    const img = page.locator('img[class*="shotPhoto"]');
    await expect(img).toBeVisible();
    // Під навантаженням фото ще може догружатись — розмір перевіряємо, доки не встоїться
    await expect.poll(() => img.evaluate(inside)).toBe(true);
  });
}

test("каталог: фото моделей повністю в рамках", async ({ page }) => {
  await page.goto("/modeli", { waitUntil: "networkidle" });
  const imgs = page.locator('img[class*="ModelGrid-module"]');
  expect(await imgs.count()).toBeGreaterThan(0);
  const results = await imgs.evaluateAll((all, fn) => all.slice(0, 6).map((i) => new Function("return " + fn)()(i)), inside.toString());
  expect(results.every(Boolean)).toBe(true);
});
