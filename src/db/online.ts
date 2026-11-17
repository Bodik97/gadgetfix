import { and, asc, desc, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import { leads, partnerPrices, partnerSettlements, type Lead, type PartnerPrice, type PartnerSettlement } from "./schema";

/**
 * Облік магазину «Онлайн»: прайс і розрахунок за місяць.
 * Місяць рахуємо за днем, коли телефон віддали магазину (issuedAt), за Києвом.
 */

/** «2026-11» → перший день місяця о 00:00 за Києвом */
export function monthStartKyiv(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  // Київ: UTC+2 узимку, UTC+3 улітку. Беремо зсув саме на той день
  const probe = new Date(Date.UTC(y, m - 1, 1, 12));
  const offset = kyivOffsetHours(probe);
  return new Date(Date.UTC(y, m - 1, 1, -offset));
}

function kyivOffsetHours(at: Date): number {
  const local = new Date(at.toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 3_600_000);
}

/** Поточний місяць за Києвом: «2026-11» */
export function monthKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit" }).format(at);
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export const isMonthKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Віддані магазину телефони за місяць (без відмов) */
export async function getMonthLeads(key: string): Promise<Lead[]> {
  const from = monthStartKyiv(key);
  const to = monthStartKyiv(nextMonthKey(key));
  return getDb()
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.channel, "online"),
        eq(leads.stage, "issued"),
        or(isNull(leads.flag), ne(leads.flag, "refused")),
        gte(leads.issuedAt, from),
        lt(leads.issuedAt, to),
      ),
    )
    .orderBy(asc(leads.issuedAt));
}

export async function getSettlement(key: string): Promise<PartnerSettlement | undefined> {
  const [row] = await getDb()
    .select()
    .from(partnerSettlements)
    .where(eq(partnerSettlements.periodStart, monthStartKyiv(key)))
    .limit(1);
  return row;
}

export async function getSettlements(): Promise<PartnerSettlement[]> {
  return getDb().select().from(partnerSettlements).orderBy(desc(partnerSettlements.periodStart));
}

/** Увесь прайс, разом із прибраними позиціями — щоб їх можна було повернути */
export async function getAllPartnerPrices(): Promise<PartnerPrice[]> {
  return getDb()
    .select()
    .from(partnerPrices)
    .orderBy(desc(partnerPrices.active), asc(partnerPrices.model), asc(partnerPrices.work));
}

/** Скільки телефонів магазину ще в роботі — для підказки в розрахунку */
export async function countOnlineActive(): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.channel, "online"), ne(leads.stage, "issued"), or(isNull(leads.flag), ne(leads.flag, "refused"))));
  return row.n;
}
