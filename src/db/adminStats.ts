import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { ARCHIVED } from "@/data/leadStatus";
import { getDb } from "./index";
export { monthStart } from "@/lib/month";
import { leadEvents, leads, type LeadEvent } from "./schema";

/** Лічильники в шапці адмінки — рахуються по всій базі, не по сторінці */
export type Counters = {
  total: number;
  fresh: number;
  toShip: number;
};

export async function getCounters(): Promise<Counters> {
  const [[{ total }], [{ fresh }], [{ toShip }]] = await Promise.all([
    getDb().select({ total: count() }).from(leads),
    getDb().select({ fresh: count() }).from(leads).where(eq(leads.status, "new")),
    getDb()
      .select({ toShip: count() })
      .from(leads)
      // Закрита заявка відправки вже не чекає: пристрій видали в руки або від ремонту відмовились
      .where(and(eq(leads.deliveryRequested, true), isNull(leads.ttn), notInArray(leads.status, ARCHIVED))),
  ]);

  return { total, fresh, toShip };
}

export type Money = {
  revenue: number;
  cost: number;
  profit: number;
  jobs: number;
};


const within = (column: PgColumn, from: Date, to?: Date) =>
  to ? and(gte(column, from), lt(column, to)) : gte(column, from);

/**
 * Гроші за проміжок. Рахуємо за датою, коли гроші зайшли, а не за датою
 * заявки: ремонт, прийнятий у серпні й оплачений у вересні, належить вересню.
 *
 * Так само, як журнал каси: завдаток — у день, коли його внесли, решта — у
 * день повної оплати. Інакше плитка й журнал розходились би на роботі, де
 * завдаток дали в одному місяці, а доплатили в наступному. Деталь і сама
 * робота рахуються в день повної оплати.
 */
export async function getMoney(from: Date, to?: Date): Promise<Money> {
  const paid = within(leads.paidAt, from, to);
  const prepaid = within(leads.prepaidAt, from, to);

  const [row] = await getDb()
    .select({
      revenue: sql<number>`(
        coalesce(sum(case when ${paid} then coalesce(${leads.price}, 0)
          - case when ${leads.prepaidAt} is not null then coalesce(${leads.prepayment}, 0) else 0 end end), 0)
        + coalesce(sum(case when ${prepaid} then ${leads.prepayment} end), 0)
      )::int`,
      cost: sql<number>`coalesce(sum(case when ${paid} then ${leads.partsCost} end), 0)::int`,
      jobs: sql<number>`(count(*) filter (where ${paid}))::int`,
    })
    .from(leads)
    .where(or(paid, prepaid));

  return { ...row, profit: row.revenue - row.cost };
}

/** Хроніка для набору заявок — одним запитом, а не по одному на кожну */
export async function getEventsFor(ids: string[]): Promise<Map<string, LeadEvent[]>> {
  const byLead = new Map<string, LeadEvent[]>();
  if (ids.length === 0) return byLead;

  const rows = await getDb()
    .select()
    .from(leadEvents)
    .where(inArray(leadEvents.leadId, ids))
    .orderBy(asc(leadEvents.createdAt));

  for (const e of rows) {
    const list = byLead.get(e.leadId) ?? [];
    list.push(e);
    byLead.set(e.leadId, list);
  }

  return byLead;
}

/** Скільки грошей ще не зайшло: ціна виставлена, робота не відмовлена, оплати немає */
export type Outstanding = { jobs: number; billed: number; prepaid: number; due: number };

export async function getOutstanding(): Promise<Outstanding> {
  const [row] = await getDb()
    .select({
      jobs: count(),
      billed: sql<number>`coalesce(sum(${leads.price}), 0)::int`,
      // Лише ті завдатки, що справді надійшли: вписана сума без відмітки — ще не гроші
      prepaid: sql<number>`coalesce(sum(case when ${leads.prepaidAt} is not null then ${leads.prepayment} end), 0)::int`,
    })
    .from(leads)
    .where(
      and(isNotNull(leads.price), isNull(leads.paidAt), ne(leads.status, "rejected")),
    );

  // Передоплату клієнт уже вніс, тож до отримання лишається різниця
  return { ...row, due: row.billed - row.prepaid };
}

/** Оплачені роботи за проміжок — рядками, для таблиці та вивантаження */
export async function getPaidLeads(from: Date, to?: Date) {
  const where = to
    ? and(gte(leads.paidAt, from), lt(leads.paidAt, to))
    : gte(leads.paidAt, from);

  return getDb()
    .select({
      orderNo: leads.orderNo,
      paidAt: leads.paidAt,
      name: leads.name,
      phone: leads.phone,
      model: leads.model,
      service: leads.service,
      price: leads.price,
      partsCost: leads.partsCost,
      prepayment: leads.prepayment,
    })
    .from(leads)
    .where(where)
    .orderBy(desc(leads.paidAt));
}
