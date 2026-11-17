import Link from "next/link";
import type { Lead } from "@/db/schema";
import type { Team } from "../LeadCard";
import { BOARD_STAGES, BOARD_TITLE, isOverdue, orderLabel } from "@/lib/stage";
import { ActionButton, dueText, money, orderHref, pointText, problemText, Unread, Who } from "./parts";
import styles from "./board.module.css";

/**
 * Дошка: п'ять колонок за етапами, кожна прокручується сама.
 * У шапці колонки — кількість і сума, на картці — кнопка наступної дії.
 */
export default function Board({
  rows,
  unread,
  team,
  now,
  onlineOnly = false,
}: {
  rows: Lead[];
  /** Лише «магазин Онлайн»: він іде без діагностики й погодження — їх колонки не показуємо */
  onlineOnly?: boolean;
  unread: Map<string, number>;
  team: Team;
  now: Date;
}) {
  const stages = onlineOnly ? BOARD_STAGES.filter((s) => s !== "diagnostics" && s !== "approval") : BOARD_STAGES;

  return (
    <div className={onlineOnly ? styles.boardShort : styles.board}>
      {stages.map((stage) => {
        const cards = rows.filter((r) => r.stage === stage);
        const sum = cards.reduce((s, r) => s + (r.price ?? 0), 0);

        return (
          <section key={stage} className={styles.column} aria-label={BOARD_TITLE[stage]}>
            <div className={styles.colHead}>
              <h2 className={styles.colTitle}>{BOARD_TITLE[stage]}</h2>
              <span className={styles.colCount}>{cards.length}</span>
              {sum > 0 && <span className={styles.colSum}>{money(sum)}</span>}
            </div>

            <div className={styles.colBody}>
              {cards.map((lead) => {
                const due = dueText(lead, now);
                const late = isOverdue(lead, now);
                return (
                  <article
                    key={lead.id}
                    className={late ? styles.cardLate : styles.card}
                    data-stage={lead.stage}
                  >
                    <Link href={orderHref(lead)} className={styles.cardLink}>
                      <span className={styles.cardTop}>
                        <span className={styles.no}>{orderLabel(lead)}</span>
                        <span className={styles.where}>{pointText(lead)}</span>
                        {due.text && <span className={due.late ? styles.dueLate : styles.due}>{due.text}</span>}
                      </span>
                      <span className={styles.device}>{lead.model ?? "Модель не вказана"}</span>
                      <span className={styles.problem}>
                        {[problemText(lead), lead.channel === "own" ? lead.name : null].filter(Boolean).join(" · ")}
                      </span>
                      {lead.flag === "paused" && (
                        <span className={styles.paused}>пауза · {lead.pauseReason ?? "деталь"}</span>
                      )}
                    </Link>
                    <div className={styles.cardFoot}>
                      <Who lead={lead} team={team} />
                      <span className={styles.price}>{money(lead.price)}</span>
                      <Unread n={unread.get(lead.id) ?? 0} />
                      <ActionButton lead={lead} />
                    </div>
                  </article>
                );
              })}
              {cards.length === 0 && <p className={styles.empty}>Порожньо</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
