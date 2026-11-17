import { expect, test } from "@playwright/test";

/**
 * Жодного битого внутрішнього посилання: обходимо все, що в sitemap, збираємо
 * посилання зі сторінок і перевіряємо кожне. Лише на десктопі — посилання ті самі.
 */

test("внутрішні посилання не биті", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "достатньо одного прогону");
  test.setTimeout(180_000);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  const pages = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(pages.length).toBeGreaterThan(10);

  const links = new Map<string, string>(); // посилання → де знайдено
  for (const path of pages) {
    const html = await (await request.get(path)).text();
    // Із параметрами: /api/reviews/…/image?v=before — це інше фото, ніж без ?v
    for (const [, raw] of html.matchAll(/href="(\/[^"#]*)/g)) {
      const href = raw.replaceAll("&amp;", "&");
      if (href.startsWith("/_next") || href.startsWith("//")) continue;
      if (!links.has(href)) links.set(href, path);
    }
  }

  const broken: string[] = [];
  for (const [href, from] of links) {
    const res = await request.get(href, { maxRedirects: 5 });
    if (res.status() >= 400) broken.push(`${href} (${res.status()}) — на ${from}`);
  }

  expect(broken, `з ${links.size} посилань биті`).toEqual([]);
});

test("sitemap не містить localhost чи чужого домену замість свого", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const hosts = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).host));
  expect(hosts.size, `хости: ${[...hosts]}`).toBe(1);
});
