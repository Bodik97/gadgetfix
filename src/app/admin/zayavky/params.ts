import type { Only, Point } from "@/db/board";

export type BoardParams = {
  view: "board" | "list";
  point: Point;
  q?: string;
  mine: boolean;
  late: boolean;
  /** З плитки «Огляду»: лише готові / чекають відповіді / на паузі */
  only?: Only;
};

/** Адреса «Заявок» зі зміненим одним фільтром — решта лишається, порожні не пишемо */
export function boardHref(current: BoardParams, patch: Partial<BoardParams>): string {
  const next = { ...current, ...patch };
  const qs = new URLSearchParams();
  if (next.view === "list") qs.set("view", "list");
  if (next.point !== "all") qs.set("point", next.point);
  if (next.q) qs.set("q", next.q);
  if (next.mine) qs.set("mine", "1");
  if (next.late) qs.set("late", "1");
  if (next.only) qs.set("only", next.only);
  const s = qs.toString();
  return s ? `/admin/zayavky?${s}` : "/admin/zayavky";
}
