import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLeadById } from "@/db/events";
import { currentTeam } from "@/lib/admin";
import { orderLabel } from "@/lib/stage";
import LeadCards from "../../LeadCards";
import styles from "../../page.module.css";

export const metadata: Metadata = {
  title: "Заявка — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Заявка на окремій сторінці. Поки що — відома картка, одразу розгорнута;
 * кроки, права панель і закріплена нижня панель — етап 4 (docs/admin-handoff).
 */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const team = await currentTeam();
  if (!team) redirect("/admin/vhid");

  const { id } = await params;
  // Не UUID — такої заявки точно немає; база на кривий id кинула б помилку
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const lead = await getLeadById(id);
  if (!lead) notFound();

  return (
    <section className={styles.wrap}>
      <h1 className={styles.title}>Заявка {orderLabel(lead)}</h1>
      <LeadCards rows={[lead]} team={team} openId={lead.id} />
    </section>
  );
}
