import { kyivDay, kyivDayStart, kyivYearStart, monthStart } from "@/lib/month";

export const PERIODS = [
  { value: "month", label: "Цей місяць" },
  { value: "prev", label: "Минулий місяць" },
  { value: "quarter", label: "Останні 3 місяці" },
  { value: "year", label: "Цей рік" },
  { value: "all", label: "За весь час" },
] as const;

export type PeriodValue = (typeof PERIODS)[number]["value"];

/** Проміжок, за який дивимось касу. `to` — уже за межею, не включно. */
export type Range = { from: Date; to?: Date; label: string; fromDay: string; toDay: string };

export function isPeriod(v: string | undefined): v is PeriodValue {
  return PERIODS.some((p) => p.value === v);
}

const isDay = (v: string | undefined): v is string => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");

/** «2026-09-15» → мить, коли цей день починається в Києві; `plus` — на стільки днів пізніше */
function dayStart(day: string, plus = 0): Date {
  const [y, m, d] = day.split("-").map(Number);
  return kyivDayStart(y, m, d + plus);
}

/** Дата → «2026-09-15» за київським календарем, а не за поясом сервера */
export function dayString(d: Date): string {
  return kyivDay(d);
}

/** Умовний початок для «за весь час»: раніше записів у касі немає */
const EPOCH = kyivDayStart(2020, 1, 1);

function preset(period: PeriodValue): { from: Date; to?: Date } {
  switch (period) {
    case "prev":
      return { from: monthStart(1), to: monthStart(0) };
    case "quarter":
      return { from: monthStart(2) };
    case "year":
      return { from: kyivYearStart() };
    case "all":
      return { from: EPOCH };
    default:
      return { from: monthStart(0) };
  }
}

/**
 * Довільні дати мають перевагу над готовим періодом: щойно майстер обрав
 * день у календарі, кнопки-пресети стають лише швидким способом ці дати
 * заповнити.
 */
export function resolveRange(params: { period?: string; from?: string; to?: string }): Range {
  if (isDay(params.from) || isDay(params.to)) {
    const from = isDay(params.from) ? dayStart(params.from) : EPOCH;

    // Кінцевий день має входити повністю, тому беремо початок наступного.
    // Не «плюс 24 години»: у день переведення годинника доба має 23 або 25 годин
    const toDay = isDay(params.to) ? dayStart(params.to) : null;
    const to = isDay(params.to) ? dayStart(params.to, 1) : undefined;

    return {
      from,
      to,
      label: "вибрані дати",
      fromDay: dayString(from),
      toDay: toDay ? dayString(toDay) : "",
    };
  }

  const period = isPeriod(params.period) ? params.period : "month";
  const { from, to } = preset(period);

  return {
    from,
    to,
    label: PERIODS.find((p) => p.value === period)!.label,
    fromDay: dayString(from),
    // У відкритого періоду кінця немає, але порожнє поле в календарі читається
    // як незаповнене — показуємо сьогодні, бо саме до сьогодні й рахуємо
    // Остання мить перед межею — це й є останній день періоду
    toDay: to ? dayString(new Date(to.getTime() - 1)) : dayString(new Date()),
  };
}
