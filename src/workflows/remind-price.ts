import { sleep } from "workflow";
import { and, eq, like } from "drizzle-orm";
import { getDb } from "@/db";
import { leadEvents, leads, type Lead } from "@/db/schema";
import { addEvent } from "@/db/events";
import { leadLink } from "@/lib/adminLinks";
import { offerPrice } from "@/lib/clientBot";
import { sendPush } from "@/lib/push";

/**
 * Ціну надіслали, а клієнт мовчить добу — нагадуємо йому в Telegram
 * (та сама ціна з кнопками) і кажемо майстрам. Відповів, відмовився,
 * поставили на паузу чи ремонт уже пішов далі — нагадування не буде.
 *
 * Чекання — sleep() Workflow: не працює й не коштує нічого, поки спить.
 */

/** Заявка досі чекає відповіді на ту саму ціну? */
export async function stillWaitingPrice(leadId: string, price: number): Promise<Lead | null> {
  "use step";
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead || lead.stage !== "approval" || lead.flag || lead.price !== price) return null;

  const [agreed] = await getDb()
    .select({ id: leadEvents.id })
    .from(leadEvents)
    .where(and(eq(leadEvents.leadId, leadId), like(leadEvents.text, "Клієнт погодив ціну%")))
    .limit(1);
  return agreed ? null : lead;
}

export async function remindClient(lead: Lead): Promise<void> {
  "use step";
  const sent = await offerPrice(lead);
  await addEvent(lead.id, {
    text: sent ? "Автонагадування: клієнт добу не відповідає — ціну надіслано ще раз" : "Клієнт добу не відповідає, Telegram немає — подзвоніть",
    actor: "auto",
  });
  await sendPush({
    title: `№${lead.orderNo}: клієнт мовчить про ціну`,
    body: sent ? "Нагадали в Telegram. Якщо й далі тиша — подзвоніть." : "Без Telegram — подзвоніть клієнту.",
    url: leadLink(lead.orderNo, lead.id),
    tag: `price-${lead.id}`,
  });
}

export async function remindPriceLater(leadId: string, price: number) {
  "use workflow";

  await sleep("24h");
  const lead = await stillWaitingPrice(leadId, price);
  if (!lead) return { reminded: false };
  await remindClient(lead);
  return { reminded: true };
}
