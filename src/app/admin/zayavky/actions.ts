"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, partnerPrices, type PartnerPrice } from "@/db/schema";
import { addEvent, getLeadById } from "@/db/events";
import { currentAdmin } from "@/lib/admin";
import { notifyClientStatus } from "@/lib/clientBot";
import { nextAction, onlineWarranty, stageToStatus } from "@/lib/stage";
import { pushStatusToClient } from "@/lib/statusPush";
import { LIMITS, plainText } from "@/lib/validate";
import { parseBatch } from "@/lib/onlineBatch";

/**
 * Кнопка наступної дії на дошці: «Взяти собі», «Погодив», «Готово», «Віддати».
 *
 * Сервер сам вирішує, куди можна перейти (nextAction), — з форми беремо
 * лише id і бажаний етап. Не збігся (заявку вже рухнули з іншого телефона
 * або подвійний клік) — нічого не робимо.
 */
export async function moveStage(formData: FormData): Promise<void> {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");
  const lead = id ? await getLeadById(id) : undefined;
  if (!lead) return;

  const action = nextAction(lead);
  if (action?.kind !== "move" || action.to !== to) return;

  const status = stageToStatus(action.to, null, lead.ttn);
  const now = new Date();

  // Умова на поточний етап — у самому UPDATE: з двох одночасних натискань спрацює одне
  const moved = await getDb()
    .update(leads)
    .set({
      stage: action.to,
      status,
      assignee: action.take && !lead.assignee ? me.email : lead.assignee,
      issuedAt: action.to === "issued" ? now : lead.issuedAt,
      // Віддали магазину — місяць гарантії, як дає магазин своїм клієнтам
      ...(action.to === "issued" && lead.channel === "online" ? onlineWarranty(now) : {}),
      updatedAt: now,
    })
    .where(and(eq(leads.id, id), eq(leads.stage, lead.stage)))
    .returning({ id: leads.id });
  if (moved.length === 0) return;

  if (status !== lead.status) {
    // Статус змінився — це подія й для клієнта
    await addEvent(id, { status, stage: action.to, actor: me.email });
    if (lead.channel === "own") {
      await notifyClientStatus({ ...lead, status });
      await pushStatusToClient(lead, status);
    }
  } else {
    // Лише внутрішній крок — в історію адмінки
    await addEvent(id, { stage: action.to, actor: me.email });
  }

  revalidatePath("/admin", "layout");
}

/** Зняти паузу — заявка повертається в роботу з того ж етапу */
export async function resumeLead(formData: FormData): Promise<void> {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const done = await getDb()
    .update(leads)
    .set({ flag: null, pauseReason: null, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.flag, "paused")))
    .returning({ id: leads.id });
  if (done.length > 0) await addEvent(id, { text: "Зняли з паузи", actor: me.email });

  revalidatePath("/admin", "layout");
}

/**
 * Швидкий прийом від магазину «Онлайн»: № квитанції магазину, робота з його
 * прайсу (ціна й собівартість підставляються з прайсу) і примітка.
 * Без клієнта, фото й підпису — телефон приносить магазин.
 */
export async function createOnlineLead(_prev: string | null, formData: FormData): Promise<string | null> {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");

  const externalNo = plainText(String(formData.get("externalNo") ?? ""), LIMITS.short).trim();
  const priceId = String(formData.get("priceId") ?? "");
  const note = plainText(String(formData.get("note") ?? ""), LIMITS.problem, true).trim() || null;

  if (!externalNo) return "Впишіть № квитанції магазину.";

  const [item] = priceId
    ? await getDb().select().from(partnerPrices).where(eq(partnerPrices.id, priceId)).limit(1)
    : [];
  if (!item || !item.active) return "Виберіть роботу з прайсу магазину.";
  if (await externalTaken(externalNo)) return `${externalNo} уже прийнято — він є серед активних заявок.`;

  await insertOnlineLead(item, externalNo, note);

  revalidatePath("/admin", "layout");
  return null;
}

/** № квитанції магазину вже є серед активних заявок — другий раз той самий телефон не приймаємо */
async function externalTaken(externalNo: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.channel, "online"), eq(leads.externalNo, externalNo), ne(leads.stage, "issued")))
    .limit(1);
  return Boolean(row);
}

/** Заявка магазину: ціна й собівартість — з прайсу, номер О-… — з окремої послідовності */
async function insertOnlineLead(item: PartnerPrice, externalNo: string, note: string | null) {
  await getDb()
    .insert(leads)
    .values({
      name: "Магазин «Онлайн»",
      channel: "online",
      onlineNo: sql`nextval('online_no_seq')`,
      externalNo,
      model: item.model,
      service: item.work,
      problem: note,
      price: item.price,
      partsCost: item.cost,
      source: "manual",
    });
}

export type BatchResult = { created: number; failed: { line: string; reason: string }[] };

/**
 * Прийом пачкою: вставили список із повідомлення магазину — кожен впізнаний
 * рядок стає заявкою, невпізнані повертаються списком, щоб додати їх вручну.
 */
export async function createOnlineBatch(_prev: BatchResult | null, formData: FormData): Promise<BatchResult> {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");

  const text = String(formData.get("text") ?? "").slice(0, 10_000);
  const prices = await getDb().select().from(partnerPrices).where(eq(partnerPrices.active, true));
  const lines = parseBatch(text, prices);

  let created = 0;
  const failed: BatchResult["failed"] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    if (!l.ok) {
      failed.push({ line: l.line, reason: l.reason });
      continue;
    }
    if (seen.has(l.externalNo) || (await externalTaken(l.externalNo))) {
      failed.push({ line: l.line, reason: "цей № уже прийнято" });
      continue;
    }
    seen.add(l.externalNo);
    const item = prices.find((p) => p.id === l.priceId)!;
    await insertOnlineLead(item, l.externalNo, l.note && plainText(l.note, LIMITS.problem).trim());
    created++;
  }

  if (created > 0) revalidatePath("/admin", "layout");
  return { created, failed };
}
