import { and, count, desc, eq, ilike, inArray, isNull, notInArray, or } from "drizzle-orm";
import { getDb } from "./index";
import { leads, type Lead } from "./schema";
import { phoneKey, phoneKeySql } from "./clients";
import { ARCHIVED } from "@/data/leadStatus";
export { ARCHIVED, STAGES, STATUS_OPTIONS, describeStatus, type StatusInfo } from "@/data/leadStatus";

/**
 * Заявки клієнта. Шукаємо і за акаунтом, і за поштою — щоб людина побачила
 * те, що лишала до реєстрації з тією самою адресою.
 */
export async function getClientLeads(clerkUserId: string, email?: string | null): Promise<Lead[]> {
  const match = email
    ? or(eq(leads.clerkUserId, clerkUserId), eq(leads.email, email))
    : eq(leads.clerkUserId, clerkUserId);

  return getDb().select().from(leads).where(match).orderBy(desc(leads.createdAt));
}

/** Що майстер шукає і як звузив список */
export type LeadFilter = {
  /** Ім'я, телефон, пошта, модель, опис поломки або номер замовлення */
  q?: string;
  status?: Lead["status"];
  /** Лише ті, що клієнт просив надіслати, а ТТН ще немає */
  shipping?: boolean;
  /** Робочий список, архів закритих або все разом (пошук) */
  scope?: "active" | "archive" | "all";
  page: number;
  perPage: number;
};

/** Найбільше число, яке вміщує колонка order_no (int4) */
const MAX_ORDER_NO = 2_147_483_647;

/** Умова вибірки — спільна для списку і для підрахунку сторінок */
function leadWhere({ q, status, shipping, scope = "all" }: LeadFilter) {
  const parts = [];

  const text = q?.trim();
  if (text) {
    const like = `%${text}%`;
    const fields = [
      ilike(leads.name, like),
      ilike(leads.phone, like),
      ilike(leads.email, like),
      ilike(leads.model, like),
      ilike(leads.problem, like),
    ];

    // Номер замовлення майстер шукає так само, як ім'я — в тому ж полі.
    // Довші цифри — це телефон або ТТН: у колонку номера вони не влазять, і база відповіла б помилкою
    if (/^\d+$/.test(text) && Number(text) <= MAX_ORDER_NO) fields.push(eq(leads.orderNo, Number(text)));

    // Телефон шукаємо за тим самим ключем, яким рахуємо «N-е звернення»: у базі
    // номер записаний то з «+380», то з «0», і точний збіг рядка знайшов би не всі
    const key = /^[\d\s()+-]+$/.test(text) ? phoneKey(text) : null;
    if (key) fields.push(eq(phoneKeySql, key));

    parts.push(or(...fields));
  }

  if (scope === "active") parts.push(notInArray(leads.status, ARCHIVED));
  if (scope === "archive") parts.push(inArray(leads.status, ARCHIVED));
  if (status) parts.push(eq(leads.status, status));
  if (shipping) {
    parts.push(and(eq(leads.deliveryRequested, true), isNull(leads.ttn), notInArray(leads.status, ARCHIVED)));
  }

  return parts.length ? and(...parts) : undefined;
}

/** Сторінка заявок для адмінки разом із кількістю знайдених */
export async function findLeads(filter: LeadFilter): Promise<{ rows: Lead[]; found: number }> {
  const where = leadWhere(filter);

  const [rows, [{ found }]] = await Promise.all([
    getDb()
      .select()
      .from(leads)
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(filter.perPage)
      .offset((filter.page - 1) * filter.perPage),
    getDb().select({ found: count() }).from(leads).where(where),
  ]);

  return { rows, found };
}

/** Мінімум про заявку — для сповіщення майстру: номер і чиє це звернення */
export async function getLeadBrief(id: string): Promise<{ orderNo: number; name: string } | undefined> {
  const [row] = await getDb()
    .select({ orderNo: leads.orderNo, name: leads.name })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  return row;
}
