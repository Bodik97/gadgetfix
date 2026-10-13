/**
 * Сервіс працює за київським часом, а сервер — за UTC. Межі дня й місяця
 * рахуємо в поясі Києва: інакше ремонт, оплачений о пів на другу ночі
 * 1 листопада, потрапляв би в жовтень.
 */
export const KYIV = "Europe/Kyiv";

const kyivParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: KYIV,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Що показує київський годинник у цю мить */
function kyivClock(at: Date) {
  const p: Record<string, number> = {};
  for (const { type, value } of kyivParts.formatToParts(at)) p[type] = Number(value);
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** На скільки мілісекунд Київ попереду UTC у цю мить: взимку дві години, влітку три */
function kyivOffset(at: number): number {
  const c = kyivClock(new Date(at));
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - Math.floor(at / 1000) * 1000;
}

/**
 * Мить, коли в Києві починається цей день. Місяць — від 1; день і місяць
 * можуть виходити за межі («32 січня», «0-й місяць») — вони переносяться
 * так само, як у Date.
 */
export function kyivDayStart(year: number, month: number, day: number): Date {
  const asUtc = Date.UTC(year, month - 1, day);
  // Зсув беремо двічі: перша оцінка може потрапити по інший бік переведення годинника
  const guess = asUtc - kyivOffset(asUtc);
  return new Date(asUtc - kyivOffset(guess));
}

/** «2026-10-31» — який це день у Києві */
export function kyivDay(at: Date): string {
  const c = kyivClock(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${c.year}-${p(c.month)}-${p(c.day)}`;
}

/** Початок року за київським часом */
export function kyivYearStart(): Date {
  return kyivDayStart(kyivClock(new Date()).year, 1, 1);
}

/**
 * Перше число місяця за київським часом, зсунуте на `back` місяців назад.
 *
 * Живе окремо від запитів до бази навмисно: цим користується і клієнтський
 * вибір періоду в касі. Поки функція лежала в @/db/adminStats, той вибір
 * тягнув за собою в браузер увесь драйвер бази — мовчки, поки модуль не
 * позначили як серверний.
 */
export function monthStart(back = 0): Date {
  const now = kyivClock(new Date());
  return kyivDayStart(now.year, now.month - back, 1);
}
