import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "./index";
import { leadEvents, type Lead } from "./schema";
import { getBoardLeads } from "./board";
import { unreadByLead } from "./messages";
import { isOverdue } from "@/lib/stage";

/**
 * «Огляд»: що зараз горить. Одна вибірка активних заявок — з неї й плитки,
 * і «Потрібна дія», і «Хто чим зайнятий».
 */

export type Tiles = { late: number; ready: number; approval: number; paused: number };

export type ActionKind = "call" | "reply" | "remind" | "take" | "issue" | "give" | "open";

export type ActionRow = {
  lead: Lead;
  kind: ActionKind;
  /** Мітка по центру колонки */
  tag: string;
  tone: "red" | "amber" | "lime" | "gray";
};

const HOUR = 3_600_000;

export async function getToday(now: Date = new Date()) {
  const active = await getBoardLeads({ point: "all" });
  const ids = active.map((l) => l.id);

  const [unread, approvalSince] = await Promise.all([
    unreadByLead(ids, "client"),
    approvalTimes(active.filter((l) => l.stage === "approval").map((l) => l.id)),
  ]);

  const tiles: Tiles = { late: 0, ready: 0, approval: 0, paused: 0 };
  for (const l of active) {
    if (isOverdue(l, now)) tiles.late++;
    if (l.flag === "paused") tiles.paused++;
    else if (l.stage === "ready") tiles.ready++;
    else if (l.stage === "approval") tiles.approval++;
  }

  // Одна заявка — один рядок, з найважливішою причиною
  const rows: ActionRow[] = [];
  const seen = new Set<string>();
  const add = (row: ActionRow) => {
    if (seen.has(row.lead.id)) return;
    seen.add(row.lead.id);
    rows.push(row);
  };

  for (const l of active) {
    if (!isOverdue(l, now)) continue;
    const days = Math.max(1, Math.round((now.getTime() - l.dueAt!.getTime()) / (24 * HOUR)));
    add({ lead: l, kind: l.channel === "own" && l.phone ? "call" : "open", tag: `прострочено ${days} д`, tone: "red" });
  }
  for (const l of active) {
    const n = unread.get(l.id) ?? 0;
    if (n > 0) add({ lead: l, kind: "reply", tag: `${n} нов. повідомл.`, tone: "red" });
  }
  for (const l of active) {
    if (l.flag || l.stage !== "approval") continue;
    const since = approvalSince.get(l.id);
    // Чекає відповідь — нагадати є сенс, коли минула хоча б доба
    if (since && now.getTime() - since.getTime() > 24 * HOUR) add({ lead: l, kind: "remind", tag: "чекає відповідь", tone: "amber" });
  }
  for (const l of active) {
    if (l.flag === "paused") add({ lead: l, kind: "open", tag: `пауза · ${l.pauseReason ?? "деталь"}`, tone: "amber" });
  }
  for (const l of active) {
    if (!l.flag && l.stage === "ready") add({ lead: l, kind: l.channel === "online" ? "give" : "issue", tag: "готово", tone: "lime" });
  }
  for (const l of active) {
    if (!l.flag && l.stage === "new" && !l.assignee) add({ lead: l, kind: "take", tag: l.channel === "online" ? "нова від магазину" : "нова", tone: "gray" });
  }

  return { active, tiles, rows: rows.slice(0, 12), more: Math.max(0, rows.length - 12) };
}

/** Коли заявки потрапили на «Погодження» — з історії (подія з цим етапом) */
async function approvalTimes(ids: string[]): Promise<Map<string, Date>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ leadId: leadEvents.leadId, at: leadEvents.createdAt })
    .from(leadEvents)
    .where(and(inArray(leadEvents.leadId, ids), eq(leadEvents.stage, "approval"), isNotNull(leadEvents.stage)))
    .orderBy(desc(leadEvents.createdAt));
  const map = new Map<string, Date>();
  for (const r of rows) if (!map.has(r.leadId)) map.set(r.leadId, r.at);
  return map;
}
