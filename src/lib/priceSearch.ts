import { allModels } from "@/data/catalog";
import { modelPrices, type JobPrice } from "@/data/prices";
import { services } from "@/data/services";

/**
 * «Роботи і ціни» у швидкому пошуку: «13 pro екран» → «iPhone 13 Pro · Заміна екрана — 3 400–8 900 ₴».
 * Наш прайс (сайт) і, окремо, прайс магазину «Онлайн».
 */

export type PriceHit = { title: string; price: string; online: boolean };

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;
const show = (p: JobPrice) => (typeof p === "number" ? uah(p) : `${uah(p.analog)} – ${uah(p.original)}`);
const norm = (s: string) => s.toLowerCase().replace(/[ʼ'’]/g, "").replace(/\s+/g, " ").trim();

type Entry = { title: string; price: string; online: boolean; key: string };

/** Наш прайс — один раз на процес: дані статичні */
let own: Entry[] | null = null;
function ownEntries(): Entry[] {
  if (own) return own;
  const names = new Map(allModels.map((m) => [m.slug, m.name]));
  const jobs = new Map(services.map((s) => [s.slug, s.title]));
  own = Object.entries(modelPrices).flatMap(([slug, prices]) =>
    Object.entries(prices).map(([job, price]) => {
      const title = `${names.get(slug) ?? slug} · ${jobs.get(job) ?? job}`;
      return { title, price: show(price as JobPrice), online: false, key: norm(title) };
    }),
  );
  return own;
}

/** Усі слова запиту мають знайтися в назві: «13 pro екран» — так, «13 екран pro max» — лише Pro Max */
export function searchPrices(q: string, online: { model: string; work: string; price: number }[], limit = 5): PriceHit[] {
  const words = norm(q).split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const match = (key: string) => words.every((w) => key.includes(w));

  const shop: Entry[] = online.map((p) => {
    const title = `${p.model} · ${p.work}`;
    return { title, price: uah(p.price), online: true, key: norm(title) };
  });

  return [...ownEntries(), ...shop]
    .filter((e) => match(e.key))
    // Коротша назва — точніший збіг: «iPhone 13 Pro» раніше за «iPhone 13 Pro Max»
    .sort((a, b) => a.key.length - b.key.length)
    .slice(0, limit)
    .map(({ title, price, online }) => ({ title, price, online }));
}
