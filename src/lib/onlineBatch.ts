/**
 * Прийом пачкою: магазин пише списком, по телефону в рядку —
 * «М-4486 Redmi 13C АКБ» або «4486 — redmi 13c акб, тріснуте скло».
 * Розбираємо кожен рядок на № магазину і позицію з прайсу.
 *
 * Чиста функція без бази — її легко перевірити тестом.
 */

export type PriceRef = { id: string; model: string; work: string };

export type BatchLine =
  | { ok: true; line: string; externalNo: string; priceId: string; note: string | null }
  | { ok: false; line: string; reason: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʼ'’]/g, "")
    .replace(/[—–,;:.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function parseBatch(text: string, prices: PriceRef[]): BatchLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((line): BatchLine => {
      // № магазину на початку: «М-4486», «м 4486», «4486»
      const no = /^[мm]?\s*-?\s*(\d{1,8})\b/i.exec(line);
      if (!no) return { ok: false, line, reason: "немає № магазину на початку" };

      const rest = norm(line.slice(no[0].length));
      // Найдовший збіг «модель + робота» — щоб «iPhone 13 Pro Max» не впізнався як «iPhone 13 Pro»
      const hit = prices
        .filter((p) => {
          const model = norm(p.model);
          const work = norm(p.work);
          return rest.includes(model) && rest.replace(model, " ").includes(work);
        })
        .sort((a, b) => b.model.length + b.work.length - (a.model.length + a.work.length))[0];
      if (!hit) return { ok: false, line, reason: "не знайшли в прайсі" };

      // Що лишилось після моделі й роботи — примітка («тріснуте скло»)
      const note = norm(rest.replace(norm(hit.model), " ").replace(norm(hit.work), " "));
      return { ok: true, line, externalNo: `М-${no[1]}`, priceId: hit.id, note: note || null };
    });
}
