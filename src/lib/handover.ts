import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { addEvent, getHandoverDate, getLeadById, registerDevice } from "@/db/events";
import { leads, type Lead } from "@/db/schema";
import { guessWarrantyDays, warrantyEnd } from "@/data/warranty";
import { notifyClientStatus } from "./clientBot";

/**
 * Пристрій у клієнта: заявка закривається, і з цього дня рахується гарантія.
 *
 * Сюди ведуть усі шляхи: майстер видав у руки, клієнт підтвердив у боті, що
 * забрав посилку, Нова Пошта повідомила про отримання або майстер закрив
 * відправлену заявку сам. Дата гарантії ставиться раз — повторне закриття
 * її не зсуває.
 *
 * Шляхи можуть зійтись в одну мить (клієнт тисне кнопку, поки ми питаємо
 * Нову Пошту), тому закриває лише один: умова «ще не закрита» стоїть у
 * самому UPDATE, а не перевіряється на рядку, прочитаному раніше. Решта
 * виходить без другої події й другого «Завершено» клієнту.
 *
 * Кроків кілька, і кожен — окремий запит. Якщо попередня спроба обірвалась
 * посередині, повторний виклик доробляє те, чого бракує: подію в хроніці,
 * пристрій у кабінеті, повідомлення клієнту.
 *
 * `note` — рядок у хроніку, коли закрив не майстер («клієнт підтвердив…»).
 */
export async function closeOrder(lead: Lead, note?: string): Promise<Lead> {
  const days = lead.warrantyDays ?? guessWarrantyDays(lead.service ?? lead.problem);
  const warrantyUntil = lead.warrantyUntil ?? warrantyEnd(new Date(), days);

  const claimed = await getDb()
    .update(leads)
    .set({ status: "done", warrantyUntil, updatedAt: new Date() })
    .where(and(eq(leads.id, lead.id), ne(leads.status, "done")))
    .returning({ id: leads.id });

  let closed: Lead = { ...lead, status: "done", warrantyUntil };
  let tell = claimed.length > 0;

  if (!tell) {
    // Заявку вже закрили. Беремо її як є в базі: дату гарантії поставив той, хто закрив
    const current = await getLeadById(lead.id);
    if (!current || current.status !== "done") return lead;

    closed = current;
    // Статус «done» є, а події немає — попередня спроба обірвалась одразу після нього
    tell = (await getHandoverDate(lead.id)) === null;
  }

  // Хроніка: клієнт бачить, що саме сталося, а не лише підсвічену стадію
  if (tell) await addEvent(lead.id, { status: "done", text: note });

  // Пристрій потрапляє в список клієнта з гарантією — якщо вона є
  await registerDevice(closed);

  if (tell) await notifyClientStatus(closed);
  return closed;
}
