import { unreadByLead } from "@/db/messages";
import { getEventsFor } from "@/db/adminStats";
import { ARCHIVED } from "@/db/leads";
import { getOrderCounts, phoneKey } from "@/db/clients";
import { getPriceHints, hintKey } from "@/db/priceHistory";
import { getReviewDiscounts } from "@/db/reviews";
import type { Lead } from "@/db/schema";
import { clientBotReady, linkedLeads } from "@/lib/clientBot";
import LeadCard, { type Team } from "./LeadCard";
import styles from "./page.module.css";

/**
 * Картки заявок з усім, що їм потрібно: хроніка, непрочитані, звернення
 * клієнта, підказка ціни, бот, знижка. Спільне для архіву й сторінки заявки.
 */
export default async function LeadCards({
  rows,
  team,
  openId,
}: {
  rows: Lead[];
  team: Team;
  /** Заявка, яку показати одразу розгорнутою */
  openId?: string;
}) {
  const ids = rows.map((r) => r.id);
  const [eventsByLead, unread, orderCounts, priceHints, withBot, discounts] = await Promise.all([
    getEventsFor(ids),
    unreadByLead(ids, "client"),
    getOrderCounts(rows.map((r) => r.phone)),
    getPriceHints(),
    linkedLeads(rows),
    getReviewDiscounts(),
  ]);

  // Невикористану знижку показуємо на відкритих заявках клієнта, використану — там, де її врахували
  const discountFor = (r: (typeof rows)[number]) => {
    const applied = discounts.find((d) => d.discountLeadId === r.id);
    if (applied) return { reviewId: applied.id, applied: true };
    if (ARCHIVED.includes(r.status) || !r.clerkUserId) return null;
    const open = discounts.find((d) => !d.discountLeadId && d.clerkUserId === r.clerkUserId);
    return open ? { reviewId: open.id, applied: false } : null;
  };
  const botReady = clientBotReady();


  return (
        <div className={styles.cards}>
          {rows.map((r) => (
            <LeadCard
              key={r.id}
              lead={r}
              events={eventsByLead.get(r.id) ?? []}
              unread={unread.get(r.id) ?? 0}
              defaultOpen={r.id === openId}
              team={team}
              telegram={botReady ? withBot.has(r.id) : null}
              discount={discountFor(r)}
              orders={orderCounts.get(phoneKey(r.phone) ?? "") ?? 1}
              /* Заявки без ціни не входять у власну статистику, тож підказка
                 завжди про інші ремонти. Там, де ціна вже стоїть, вона зайва. */
              priceHint={
                r.price === null ? (priceHints.get(hintKey(r.model, r.service) ?? "") ?? null) : null
              }
            />
          ))}
        </div>
  );
}
