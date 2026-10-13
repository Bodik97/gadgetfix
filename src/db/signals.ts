import { and, asc, count, desc, eq, isNotNull, isNull, notInArray } from "drizzle-orm";
import { ARCHIVED } from "@/data/leadStatus";
import { getDb } from "./index";
import { leadMessages, leads, reviews } from "./schema";

/**
 * Сигнали для головної адмінки — усе, що чекає на майстра просто зараз.
 *
 * Найстаріше першим: сайт обіцяє передзвонити за 25 хвилин, і заявка, що
 * чекає найдовше, — найгарячіша.
 */

export type FreshSignal = {
  leadId: string;
  orderNo: number;
  name: string;
  phone: string | null;
  what: string | null;
  /** Хто з майстрів уже взяв — щоб другий не дзвонив тому самому клієнту */
  assignee: string | null;
  at: Date;
};

export type ChatSignal = {
  leadId: string;
  orderNo: number;
  name: string;
  count: number;
  /** Останнє непрочитане — щоб було видно, про що пишуть, не відкриваючи чат */
  lastText: string;
  at: Date;
};

export type ShipSignal = {
  leadId: string;
  orderNo: number;
  name: string;
  address: string | null;
  at: Date;
};

export type ReviewSignal = {
  id: string;
  author: string;
  rating: number;
  text: string;
  at: Date;
};

export type Signals = {
  fresh: FreshSignal[];
  chats: ChatSignal[];
  ship: ShipSignal[];
  reviews: ReviewSignal[];
};

/** Більше на одному екрані все одно не опрацювати — решта у списках */
const LIMIT = 20;

export async function getSignals(): Promise<Signals> {
  const db = getDb();

  const [fresh, unread, ship, pending] = await Promise.all([
    db
      .select({
        leadId: leads.id,
        orderNo: leads.orderNo,
        name: leads.name,
        phone: leads.phone,
        model: leads.model,
        service: leads.service,
        assignee: leads.assignee,
        at: leads.createdAt,
      })
      .from(leads)
      .where(eq(leads.status, "new"))
      .orderBy(asc(leads.createdAt))
      .limit(LIMIT),

    // Непрочитані від клієнтів, новіші першими — перше по кожній заявці і є останнім
    db
      .select({
        leadId: leadMessages.leadId,
        text: leadMessages.text,
        image: leadMessages.imagePath,
        at: leadMessages.createdAt,
        orderNo: leads.orderNo,
        name: leads.name,
      })
      .from(leadMessages)
      .innerJoin(leads, eq(leads.id, leadMessages.leadId))
      .where(and(eq(leadMessages.author, "client"), isNull(leadMessages.readAt)))
      .orderBy(desc(leadMessages.createdAt))
      .limit(200),

    db
      .select({
        leadId: leads.id,
        orderNo: leads.orderNo,
        name: leads.name,
        address: leads.deliveryAddress,
        at: leads.updatedAt,
      })
      .from(leads)
      // Закриті не чекають відправки: пристрій видали в руки або від ремонту відмовились
      .where(and(eq(leads.deliveryRequested, true), isNull(leads.ttn), notInArray(leads.status, ARCHIVED)))
      .orderBy(asc(leads.updatedAt))
      .limit(LIMIT),

    db
      .select({
        id: reviews.id,
        author: reviews.authorName,
        rating: reviews.rating,
        text: reviews.text,
        at: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.published, false))
      .orderBy(asc(reviews.createdAt))
      .limit(LIMIT),
  ]);

  const chats = new Map<string, ChatSignal>();
  for (const m of unread) {
    const seen = chats.get(m.leadId);
    if (seen) {
      seen.count++;
      // Рядки йдуть від нових до старих — час сигналу тримаємо за найстарішим
      seen.at = m.at;
      continue;
    }
    chats.set(m.leadId, {
      leadId: m.leadId,
      orderNo: m.orderNo,
      name: m.name,
      count: 1,
      lastText: m.text || (m.image ? "Фото" : ""),
      at: m.at,
    });
  }

  return {
    fresh: fresh.map(({ model, service, ...r }) => ({ ...r, what: model ?? service })),
    chats: [...chats.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, LIMIT),
    ship,
    reviews: pending,
  };
}

export type WorkItem = {
  leadId: string;
  orderNo: number;
  name: string;
  what: string | null;
  status: string;
};

/**
 * Хто чим зайнятий: незакриті заявки кожного майстра й скільки нічиїх.
 * Ключ — пошта майстра, як у leads.assignee.
 */
export async function getWorkload(): Promise<{ byAdmin: Map<string, WorkItem[]>; unassigned: number }> {
  const db = getDb();
  const open = notInArray(leads.status, ARCHIVED);

  const [taken, [{ n }]] = await Promise.all([
    db
      .select({
        assignee: leads.assignee,
        leadId: leads.id,
        orderNo: leads.orderNo,
        name: leads.name,
        model: leads.model,
        service: leads.service,
        status: leads.status,
      })
      .from(leads)
      .where(and(open, isNotNull(leads.assignee)))
      .orderBy(asc(leads.createdAt)),
    db.select({ n: count() }).from(leads).where(and(open, isNull(leads.assignee))),
  ]);

  const byAdmin = new Map<string, WorkItem[]>();
  for (const { assignee, model, service, ...r } of taken) {
    const list = byAdmin.get(assignee!) ?? [];
    list.push({ ...r, what: model ?? service });
    byAdmin.set(assignee!, list);
  }

  return { byAdmin, unassigned: n };
}
