import { and, asc, count, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "./index";
import { leadMessages, leads, type LeadMessage } from "./schema";

/** Довше писати в чат сенсу немає — деталі простіше сказати по телефону */
export const MAX_MESSAGE = 1000;

export async function getMessages(leadId: string): Promise<LeadMessage[]> {
  return getDb()
    .select()
    .from(leadMessages)
    .where(eq(leadMessages.leadId, leadId))
    .orderBy(asc(leadMessages.createdAt));
}

/**
 * Заявка належить цьому клієнту?
 * Перевіряємо і за акаунтом, і за поштою — так само, як getClientLeads:
 * заявка могла бути залишена до реєстрації з тією самою адресою.
 */
export async function ownsLead(
  leadId: string,
  clerkUserId: string,
  email?: string | null,
): Promise<boolean> {
  const match = email
    ? or(eq(leads.clerkUserId, clerkUserId), eq(leads.email, email))
    : eq(leads.clerkUserId, clerkUserId);

  const [row] = await getDb()
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), match))
    .limit(1);

  return Boolean(row);
}

export type NewMessage = {
  text: string;
  imagePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

export async function addMessage(
  leadId: string,
  author: "client" | "master",
  msg: NewMessage,
): Promise<void> {
  const clean = msg.text.trim().slice(0, MAX_MESSAGE);
  // Порожнє повідомлення без фото зберігати немає сенсу
  if (!clean && !msg.imagePath) return;

  await getDb().insert(leadMessages).values({
    leadId,
    author,
    text: clean,
    imagePath: msg.imagePath ?? null,
    imageWidth: msg.imageWidth ?? null,
    imageHeight: msg.imageHeight ?? null,
  });
  // Надіслав — уже не друкує: «друкує…» не має висіти над готовим повідомленням
  await setTyping(leadId, author, false);
}

/** Скільки після останнього натискання клавіші вважаємо, що людина ще друкує */
export const TYPING_MS = 6_000;

const typingColumn = (side: "client" | "master") => (side === "client" ? leads.clientTypingAt : leads.masterTypingAt);

/** Позначити, що цей бік зараз друкує (або вже ні) */
export async function setTyping(leadId: string, side: "client" | "master", typing = true): Promise<void> {
  await getDb()
    .update(leads)
    .set(side === "client" ? { clientTypingAt: typing ? new Date() : null } : { masterTypingAt: typing ? new Date() : null })
    .where(eq(leads.id, leadId));
}

/** Чи друкує зараз інший бік — для «Майстер друкує…» */
export async function otherTyping(leadId: string, reader: "client" | "master"): Promise<boolean> {
  const other = reader === "client" ? "master" : "client";
  const [row] = await getDb()
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), gt(typingColumn(other), new Date(Date.now() - TYPING_MS))))
    .limit(1);
  return Boolean(row);
}

/** Одне повідомлення — щоб віддати фото лише тому, хто має доступ до заявки */
export async function getMessage(id: string): Promise<LeadMessage | undefined> {
  const [row] = await getDb().select().from(leadMessages).where(eq(leadMessages.id, id)).limit(1);
  return row;
}

/** Позначити прочитаним усе, що написав інший бік */
export async function markRead(leadId: string, reader: "client" | "master"): Promise<void> {
  const from = reader === "client" ? "master" : "client";

  await getDb()
    .update(leadMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(leadMessages.leadId, leadId),
        eq(leadMessages.author, from),
        isNull(leadMessages.readAt),
      ),
    );
}

/** Скільки непрочитаних від одного боку в конкретній заявці */
export async function countUnread(
  leadId: string,
  from: "client" | "master",
): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(leadMessages)
    .where(
      and(
        eq(leadMessages.leadId, leadId),
        eq(leadMessages.author, from),
        isNull(leadMessages.readAt),
      ),
    );

  return row?.n ?? 0;
}

/** Непрочитані від клієнтів по всіх заявках — бейдж у меню адмінки */
export async function countUnreadForMaster(): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(leadMessages)
    .where(and(eq(leadMessages.author, "client"), isNull(leadMessages.readAt)));

  return row?.n ?? 0;
}

/**
 * Непрочитані, згруповані за заявками.
 * `from` — чиї повідомлення рахуємо: "master" для сторінки клієнта,
 * "client" для адмінки.
 */
export async function unreadByLead(
  leadIds: string[],
  from: "client" | "master",
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (leadIds.length === 0) return map;

  const rows = await getDb()
    .select({ leadId: leadMessages.leadId, n: count() })
    .from(leadMessages)
    .where(
      and(
        inArray(leadMessages.leadId, leadIds),
        eq(leadMessages.author, from),
        isNull(leadMessages.readAt),
      ),
    )
    .groupBy(leadMessages.leadId);

  for (const r of rows) map.set(r.leadId, r.n);
  return map;
}
