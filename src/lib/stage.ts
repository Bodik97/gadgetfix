import type { Lead } from "@/db/schema";

/**
 * Етапи нової адмінки ↔ старий `status`, який бачить клієнт.
 *
 * Публічну частину (кабінет, перевірка статусу, Telegram-бот) не чіпаємо:
 * вона й далі читає `status`. Адмінка ж працює з `stage` + `flag`, і кожна
 * зміна етапу перераховує `status` через stageToStatus.
 *
 * Чисті функції без бази й env — їх можна викликати і в браузері, і в тестах.
 */

type Stage = Lead["stage"];
type Flag = Lead["flag"];
type Status = Lead["status"];
type Location = NonNullable<Lead["location"]>;

/** Порядок етапів — з нього малюється шкала в картці й колонки дошки */
export const STAGE_ORDER: readonly Stage[] = [
  "new",
  "diagnostics",
  "approval",
  "in_progress",
  "ready",
  "issued",
];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "Нова",
  diagnostics: "Діагностика",
  approval: "Погодження",
  in_progress: "У роботі",
  ready: "Готово",
  issued: "Видано",
};

/**
 * Що бачить клієнт. Діагностика й погодження для нього — ще «прийнято»;
 * пауза — «у роботі» (телефон у нас, ремонт не скасовано).
 * Видано з накладною — «відправлено»; без неї — «завершено».
 */
export function stageToStatus(stage: Stage, flag: Flag, ttn: string | null): Status {
  if (flag === "refused") return "rejected";
  switch (stage) {
    case "new":
    case "diagnostics":
    case "approval":
      return "new";
    case "in_progress":
      return "in_progress";
    case "ready":
      return "ready";
    case "issued":
      return ttn ? "shipped" : "done";
  }
}

/** Для перенесення старих заявок: зі старого статусу — етап і позначка */
export function statusToStage(status: Status): { stage: Stage; flag: Flag } {
  switch (status) {
    case "new":
      return { stage: "new", flag: null };
    case "in_progress":
      return { stage: "in_progress", flag: null };
    case "ready":
      return { stage: "ready", flag: null };
    case "shipped":
    case "done":
      return { stage: "issued", flag: null };
    case "rejected":
      return { stage: "new", flag: "refused" };
  }
}

/**
 * Точка для старої заявки — за майстром, який її брав (Богдан — Новий
 * Розділ, Андріан — Львів). Нова Пошта — доставка, а не точка, тож на
 * точку не впливає. Ніхто не брав — невідомо.
 */
export function guessLocation(
  lead: Pick<Lead, "assignee">,
  emails: { novyiRozdil?: string; lviv?: string },
): Location | null {
  const who = lead.assignee?.trim().toLowerCase();
  if (!who) return null;
  if (who === emails.novyiRozdil?.trim().toLowerCase()) return "novyi-rozdil";
  if (who === emails.lviv?.trim().toLowerCase()) return "lviv";
  return null;
}

/** «Прострочено» з ТЗ: термін минув, а телефон ще не віддали і не відмова */
export function isOverdue(
  lead: Pick<Lead, "dueAt" | "stage" | "flag">,
  now: Date = new Date(),
): boolean {
  return (
    lead.dueAt !== null &&
    lead.dueAt.getTime() < now.getTime() &&
    lead.stage !== "issued" &&
    lead.flag !== "refused"
  );
}

/** Номер для людини: «№1092» або «О-218» */
export function orderLabel(lead: Pick<Lead, "channel" | "orderNo" | "onlineNo">): string {
  return lead.channel === "online" && lead.onlineNo !== null
    ? `О-${lead.onlineNo}`
    : `№${lead.orderNo}`;
}
