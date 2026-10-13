/**
 * Строки гарантії за видом роботи.
 *
 * Один строк на все не годиться: оригінальний екран служить довше за аналог,
 * а після ремонту плати чи води ризик повторної поломки найвищий. Список
 * живе окремо від бази — ним користуються і адмінка, і тексти сайту.
 */
export const WARRANTY_TERMS = [
  { days: 120, label: "4 місяці", scope: "оригінальна деталь" },
  { days: 60, label: "2 місяці", scope: "деталь-аналог" },
  { days: 30, label: "30 днів", scope: "ремонт плати, відновлення після води" },
  { days: 0, label: "без гарантії", scope: "діагностика, чистка без заміни деталей" },
] as const;

/**
 * Для текстів сайту: строк залежить від деталі — 2 місяці на аналог,
 * 4 місяці на оригінал. WARRANTY_MAX — коротка форма для тісних місць,
 * WARRANTY_RANGE — для квитанції з адмінки.
 */
export const WARRANTY_MAX = "до 4 місяців";
export const WARRANTY_BY_PART = "2 місяці на аналог, 4 місяці на оригінал";
export const WARRANTY_RANGE = "від 30 днів до 4 місяців";

export const isWarrantyTerm = (days: number) => WARRANTY_TERMS.some((t) => t.days === days);

export const warrantyLabel = (days: number) =>
  WARRANTY_TERMS.find((t) => t.days === days)?.label ?? `${days} днів`;

/**
 * Строк, поки майстер не обрав сам, — за назвою послуги. Деталь за
 * замовчуванням вважаємо аналогом: оригінал майстер позначає вручну.
 */
export function guessWarrantyDays(work: string | null | undefined): number {
  const w = (work ?? "").toLowerCase();
  if (/плат|вод[иіуо]|залит|корозі/.test(w)) return 30;
  if (/діагност|чист/.test(w)) return 0;
  return 60;
}

/** До якої дати діє гарантія, якщо рахувати від `from`; null — без гарантії */
export function warrantyEnd(from: Date, days: number): Date | null {
  if (days <= 0) return null;
  const until = new Date(from);
  until.setDate(until.getDate() + days);
  return until;
}

/** Гарантія ще діє? Рахує сервер — у браузері «зараз» інше, і текст розійшовся б */
export const warrantyActive = (until: Date) => until.getTime() > Date.now();
