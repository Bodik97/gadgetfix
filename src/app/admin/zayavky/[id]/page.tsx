import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leadEvents, leadItems, leadPhotos, leadSignatures } from "@/db/schema";
import { getLeadById } from "@/db/events";
import { getOrderCounts, phoneKey } from "@/db/clients";
import { unreadByLead } from "@/db/messages";
import { getParts } from "@/db/parts";
import { currentTeam } from "@/lib/admin";
import { clientBotReady, linkedLeads } from "@/lib/clientBot";
import { statusToStage } from "@/lib/stage";
import OrderScreen, { type HistoryRow } from "./OrderScreen";

export const metadata: Metadata = {
  title: "Заявка — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Заявка на всю сторінку (docs/admin-handoff/design/Order.dc.html):
 * етапи, картка поточного кроку, закріплена нижня панель, права панель.
 */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const team = await currentTeam();
  if (!team) redirect("/admin/vhid");

  const { id } = await params;
  // Не UUID — такої заявки точно немає; база на кривий id кинула б помилку
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const lead = await getLeadById(id);
  if (!lead) notFound();

  const db = getDb();
  const [items, photos, signatures, events, unread, counts, stock, withBot] = await Promise.all([
    db.select().from(leadItems).where(eq(leadItems.leadId, id)).orderBy(asc(leadItems.createdAt)),
    db.select({ id: leadPhotos.id, slot: leadPhotos.slot }).from(leadPhotos).where(eq(leadPhotos.leadId, id)).orderBy(asc(leadPhotos.createdAt)),
    db.select({ kind: leadSignatures.kind }).from(leadSignatures).where(eq(leadSignatures.leadId, id)),
    db.select().from(leadEvents).where(eq(leadEvents.leadId, id)).orderBy(asc(leadEvents.createdAt)),
    unreadByLead([id], "client"),
    getOrderCounts([lead.phone]),
    getParts(),
    linkedLeads([lead]),
  ]);

  // Коли заявка вперше стала на кожен етап: з нової історії (stage) або,
  // для старих подій, — за статусом
  const stageTimes: Record<string, string> = { new: lead.createdAt.toISOString() };
  for (const e of events) {
    const stage = e.stage ?? (e.status ? statusToStage(e.status).stage : null);
    if (stage && !stageTimes[stage]) stageTimes[stage] = e.createdAt.toISOString();
  }
  // Крок «Видача» — це етап «Готово»; час видачі показуємо в банері
  const history: HistoryRow[] = events
    .slice()
    .reverse()
    .map((e) => ({
      at: e.createdAt.toISOString(),
      text: e.text,
      who: e.actor ? (team.names[e.actor] ?? null) : e.byMaster ? "майстер" : null,
    }));

  return (
    <OrderScreen
      lead={lead}
      items={items}
      photos={photos}
      signed={{
        intake: signatures.some((s) => s.kind === "intake"),
        handover: signatures.some((s) => s.kind === "handover"),
      }}
      stageTimes={stageTimes}
      history={history}
      unread={unread.get(id) ?? 0}
      orders={counts.get(phoneKey(lead.phone) ?? "") ?? 1}
      stock={stock.map((p) => ({ id: p.id, name: p.name, model: p.model, qty: p.qty, unitCost: p.unitCost }))}
      telegram={clientBotReady() ? withBot.has(id) : null}
      owner={team.owner}
      masterName={lead.assignee ? (team.names[lead.assignee] ?? lead.assignee) : null}
      clientAgreed={events.some((e) => e.text.startsWith("Клієнт погодив ціну"))}
    />
  );
}
