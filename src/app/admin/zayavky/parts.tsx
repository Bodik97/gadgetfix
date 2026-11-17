import Link from "next/link";
import type { Lead } from "@/db/schema";
import type { Team } from "../LeadCard";
import { isOverdue, nextAction, orderLabel } from "@/lib/stage";
import { moveStage, resumeLead } from "./actions";
import styles from "./board.module.css";

/** Спільне для дошки й списку: точка, термін, хто робить, кнопка дії */

export const orderHref = (lead: Pick<Lead, "id">) => `/admin/zayavky/${lead.id}`;

const LOCATION_SHORT: Record<NonNullable<Lead["location"]>, string> = {
  lviv: "Львів",
  "novyi-rozdil": "Н. Розділ",
  other: "Інше місто",
};

export function pointText(lead: Lead): string {
  // Пігулка «О-…» уже каже, що це магазин, — тут лише № його квитанції
  if (lead.channel === "online") return lead.externalNo ?? "магазин Онлайн";
  if (lead.location === "other") return lead.city || LOCATION_SHORT.other;
  return lead.location ? LOCATION_SHORT[lead.location] : "—";
}

const day = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", timeZone: "Europe/Kyiv" });

/**
 * «−3 год», «−1 д» для прострочених; «до 18.11» — інакше; без терміну — порожньо.
 * Готові — без терміну: про видачу вже каже кнопка.
 */
export function dueText(lead: Lead, now: Date): { text: string; late: boolean } {
  if (lead.stage === "ready") return { text: "", late: false };
  if (!lead.dueAt) return { text: "", late: false };
  if (isOverdue(lead, now)) {
    const hours = Math.max(1, Math.round((now.getTime() - lead.dueAt.getTime()) / 3_600_000));
    return { text: hours < 24 ? `−${hours} год` : `−${Math.round(hours / 24)} д`, late: true };
  }
  return { text: `до ${day.format(lead.dueAt)}`, late: false };
}

export const money = (n: number | null) => (n ? `${n.toLocaleString("uk-UA")} ₴` : "—");

/** Що за поломка — коротко, для картки */
export const problemText = (lead: Lead) =>
  lead.problems.length > 0 ? lead.problems.join(", ") : (lead.service ?? lead.problem ?? "");

/** Кружок майстра: власник — лаймовий, другий майстер — темний, ніхто — пунктир */
export function Who({ lead, team }: { lead: Lead; team: Team }) {
  const name = lead.assignee ? (team.names[lead.assignee] ?? lead.assignee) : null;
  const owner = name !== null && Object.keys(team.names)[0] === lead.assignee;
  return (
    <span
      className={name ? (owner ? styles.whoOwner : styles.whoMaster) : styles.whoNone}
      title={name ? `Робить: ${name}` : "Ще ніхто не взяв"}
      aria-label={name ? `Робить: ${name}` : "Ще ніхто не взяв"}
    >
      {name ? name.slice(0, 1).toUpperCase() : ""}
    </span>
  );
}

/** Червоний лічильник: клієнт написав, а майстер ще не прочитав */
export function Unread({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className={styles.unread} title="Непрочитані повідомлення від клієнта">
      {n} нов.
    </span>
  );
}

/**
 * Кнопка наступної дії. Переходи між етапами — звичайна форма з server action:
 * натиснув — і заявка на новому етапі, без відкриття картки.
 */
export function ActionButton({ lead }: { lead: Lead }) {
  const action = nextAction(lead);
  if (!action) return null;

  const final = lead.stage === "ready";
  const cls = final ? styles.actMain : styles.act;

  if (action.kind === "open") {
    return (
      <Link href={orderHref(lead)} className={cls}>
        {action.label}
      </Link>
    );
  }

  return (
    <form action={action.kind === "resume" ? resumeLead : moveStage}>
      <input type="hidden" name="id" value={lead.id} />
      {action.kind === "move" && <input type="hidden" name="to" value={action.to} />}
      <button type="submit" className={cls} aria-label={`${action.label}: ${orderLabel(lead)}`}>
        {action.label}
      </button>
    </form>
  );
}
