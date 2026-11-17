import Link from "next/link";
import type { Lead } from "@/db/schema";
import type { Team } from "../LeadCard";
import { isOverdue, orderLabel, STAGE_LABEL } from "@/lib/stage";
import { ActionButton, dueText, money, orderHref, pointText, problemText, Unread } from "./parts";
import styles from "./board.module.css";

/** Список — щільна таблиця; прострочені вже вгорі (так їх віддає база) */
export default function OrderTable({
  rows,
  unread,
  team,
  now,
}: {
  rows: Lead[];
  unread: Map<string, number>;
  team: Team;
  now: Date;
}) {
  if (rows.length === 0) return <p className={styles.nothing}>Нічого не знайдено.</p>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>№</th>
            <th>Пристрій</th>
            <th>Клієнт</th>
            <th>Точка</th>
            <th>Майстер</th>
            <th>Етап</th>
            <th>Термін</th>
            <th>Сума</th>
            <th>
              <span className="visually-hidden">Дія</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const due = dueText(lead, now);
            const who = lead.assignee ? (team.names[lead.assignee] ?? lead.assignee) : "—";
            return (
              <tr key={lead.id} className={isOverdue(lead, now) ? styles.rowLate : undefined}>
                <td>
                  <Link href={orderHref(lead)} className={styles.no}>
                    {orderLabel(lead)}
                  </Link>
                </td>
                <td>
                  <Link href={orderHref(lead)} className={styles.rowDevice}>
                    <b>{lead.model ?? "—"}</b> <span>· {problemText(lead)}</span>
                  </Link>
                  <Unread n={unread.get(lead.id) ?? 0} />
                </td>
                <td>{lead.channel === "online" ? "—" : lead.name}</td>
                <td>{pointText(lead)}</td>
                <td>{who}</td>
                <td>
                  <span className={styles.stageTag} data-stage={lead.stage} data-flag={lead.flag ?? undefined}>
                    {lead.flag === "refused" ? "відмова" : lead.flag === "paused" ? "пауза" : STAGE_LABEL[lead.stage]}
                  </span>
                </td>
                <td>
                  <span className={due.late ? styles.dueLate : styles.due}>{due.text}</span>
                </td>
                <td className={styles.sumCell}>{money(lead.price)}</td>
                <td>
                  <ActionButton lead={lead} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
