import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { devices, leadEvents, leads, type Device, type Lead, type LeadEvent } from "./schema";

/** Що пишемо в хроніку, коли майстер переводить заявку в новий статус */
const STATUS_EVENT: Record<Lead["status"], string> = {
  new: "Заявку прийнято",
  in_progress: "Майстер узяв пристрій у роботу",
  ready: "Ремонт завершено — пристрій готовий",
  shipped: "Пристрій передано Новій Пошті",
  done: "Пристрій у клієнта",
  rejected: "Заявку закрито",
};

export async function getEvents(leadId: string): Promise<LeadEvent[]> {
  return getDb()
    .select()
    .from(leadEvents)
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(asc(leadEvents.createdAt));
}

/** Додає подію в хроніку. text порожній — беремо стандартний текст статусу. */
export async function addEvent(
  leadId: string,
  opts: { text?: string; status?: Lead["status"]; byMaster?: boolean },
): Promise<void> {
  const text = opts.text?.trim() || (opts.status ? STATUS_EVENT[opts.status] : "");
  if (!text) return;

  await getDb().insert(leadEvents).values({
    leadId,
    text: text.slice(0, 300),
    status: opts.status ?? null,
    byMaster: opts.byMaster ?? false,
  });
}

/**
 * Коли пристрій віддали клієнту — час першої події «done» у хроніці. На
 * відміну від updatedAt, пізніші правки заявки цю дату не зсувають.
 * null — заявку закрили ще до появи хроніки.
 */
export async function getHandoverDate(leadId: string): Promise<Date | null> {
  const [row] = await getDb()
    .select({ at: leadEvents.createdAt })
    .from(leadEvents)
    .where(and(eq(leadEvents.leadId, leadId), eq(leadEvents.status, "done")))
    .orderBy(asc(leadEvents.createdAt))
    .limit(1);

  return row?.at ?? null;
}

/**
 * Ремонт завершено — заносимо пристрій у список клієнта з датою кінця гарантії.
 * Повторний виклик нічого не дублює: на одну заявку один пристрій.
 *
 * Дата — та сама, що в заявці (lead.warrantyUntil), а не порахована заново:
 * кабінет і адмінка мають показувати один день. Без гарантії пристрою в
 * списку немає. Заявку без акаунта привʼязати нема до кого: список пристроїв
 * ведеться за акаунтом клієнта.
 */
export async function registerDevice(lead: Lead): Promise<void> {
  if (!lead.clerkUserId || !lead.warrantyUntil) return;

  const db = getDb();
  const existing = await db.select().from(devices).where(eq(devices.leadId, lead.id)).limit(1);
  if (existing.length > 0) return;

  await db.insert(devices).values({
    clerkUserId: lead.clerkUserId,
    leadId: lead.id,
    name: lead.model ?? lead.service ?? lead.problem?.slice(0, 40) ?? "Пристрій",
    work: lead.problem,
    warrantyUntil: lead.warrantyUntil,
  });
}

export async function getDevices(clerkUserId: string): Promise<Device[]> {
  return getDb()
    .select()
    .from(devices)
    .where(eq(devices.clerkUserId, clerkUserId))
    .orderBy(desc(devices.createdAt));
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  const rows = await getDb().select().from(leads).where(eq(leads.id, id)).limit(1);
  return rows[0];
}
