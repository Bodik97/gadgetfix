"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leadItems, leadPhotos, leads, leadSignatures, parts, type Lead } from "@/db/schema";
import { addEvent, getLeadById } from "@/db/events";
import { releaseDiscount } from "@/db/discounts";
import { CHECKS, CONDITION, KIT, PROBLEMS } from "@/data/orderOptions";
import { onlineWarranty } from "@/lib/stage";
import { isWarrantyTerm } from "@/data/warranty";
import { currentAdmin } from "@/lib/admin";
import { notifyClientStatus, offerPrice } from "@/lib/clientBot";
import { closeOrder } from "@/lib/handover";
import { savePhoto } from "@/lib/photoPair";
import { STAGE_ORDER, stageToStatus } from "@/lib/stage";
import { pushStatusToClient } from "@/lib/statusPush";
import { LIMITS, plainText } from "@/lib/validate";

/**
 * Дії сторінки заявки. Кожне поле зберігається одразу (як у старій картці),
 * а головна кнопка внизу лише перевіряє обовʼязкове й переводить на наступний крок.
 * Помилку повертаємо текстом — її показує нижня панель, кнопку не вимикаємо.
 */

async function master() {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");
  return me;
}

const field = (form: FormData, key: string) => String(form.get(key) ?? "");

function refresh(id: string) {
  revalidatePath(`/admin/zayavky/${id}`);
  revalidatePath("/admin", "layout");
}

/** Чипи: поломки, стан, комплект — лише зі свого списку */
const LISTS = { problems: PROBLEMS, condition: CONDITION, kit: KIT } as const;

export async function saveList(form: FormData): Promise<void> {
  await master();
  const id = field(form, "id");
  const name = field(form, "field") as keyof typeof LISTS;
  const allowed: readonly string[] | undefined = LISTS[name];
  if (!id || !allowed) return;

  const values = form.getAll("value").map(String).filter((v) => allowed.includes(v));
  await getDb()
    .update(leads)
    .set({ [name]: [...new Set(values)], updatedAt: new Date() })
    .where(eq(leads.id, id));
  refresh(id);
}

/** Текстові поля, які можна правити з картки */
const TEXTS = {
  imei: LIMITS.short,
  diagnosis: LIMITS.problem,
  masterNote: LIMITS.problem,
  model: LIMITS.short,
  city: LIMITS.short,
} as const;

export async function saveText(form: FormData): Promise<void> {
  await master();
  const id = field(form, "id");
  const name = field(form, "field") as keyof typeof TEXTS;
  const max = TEXTS[name];
  if (!id || !max) return;

  const value = plainText(field(form, "value"), max, name === "diagnosis" || name === "masterNote").trim() || null;
  await getDb()
    .update(leads)
    .set({ [name]: value, updatedAt: new Date() })
    .where(eq(leads.id, id));
  refresh(id);
}

/** Точка: Львів, Новий Розділ або інше місто (тоді назва — у city) */
export async function saveLocation(form: FormData): Promise<void> {
  await master();
  const id = field(form, "id");
  const value = field(form, "value");
  if (!id || !["lviv", "novyi-rozdil", "other", ""].includes(value)) return;
  await getDb()
    .update(leads)
    .set({ location: (value || null) as Lead["location"], updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.channel, "own")));
  refresh(id);
}

/** Термін «Готово до»: дата з поля або підказка «+N днів» */
export async function saveDue(form: FormData): Promise<void> {
  await master();
  const id = field(form, "id");
  const raw = field(form, "value");
  if (!id) return;

  let dueAt: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    // Кінець дня за Києвом: «до 18.11» — це до вечора 18-го
    dueAt = new Date(`${raw}T18:00:00+02:00`);
  } else if (/^\d$/.test(raw)) {
    dueAt = addWorkingDays(new Date(), Number(raw));
  } else if (raw !== "") {
    return;
  }

  await getDb().update(leads).set({ dueAt, updatedAt: new Date() }).where(eq(leads.id, id));
  refresh(id);
}

/** +N днів без неділі, на 18:00 — підказка терміну з ТЗ («вихідні не рахуємо») */
function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  d.setHours(18, 0, 0, 0);
  return d;
}

export async function saveWarranty(form: FormData): Promise<void> {
  await master();
  const id = field(form, "id");
  const days = Number(field(form, "days"));
  if (!id || !isWarrantyTerm(days)) return;
  await getDb().update(leads).set({ warrantyDays: days, updatedAt: new Date() }).where(eq(leads.id, id));
  refresh(id);
}

export async function savePayment(form: FormData): Promise<void> {
  await master();
  const id = field(form, "id");
  const value = field(form, "value");
  if (!id || !["cash", "card", "transfer"].includes(value)) return;
  await getDb()
    .update(leads)
    .set({ paymentMethod: value as Lead["paymentMethod"], updatedAt: new Date() })
    .where(eq(leads.id, id));
  refresh(id);
}

/**
 * Передоплата: сума й дата разом. Порожня сума — передоплату прибрано.
 * Галочки «внесена» без суми більше немає — звідти бралося «оплатили 0 ₴».
 */
export async function savePrepayment(form: FormData): Promise<string | null> {
  await master();
  const id = field(form, "id");
  const raw = field(form, "amount").replace(/\s/g, "");
  if (!id) return null;

  if (raw === "") {
    await getDb().update(leads).set({ prepayment: null, prepaidAt: null, updatedAt: new Date() }).where(eq(leads.id, id));
  } else {
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) return "Передоплата — ціле число гривень.";
    await getDb()
      .update(leads)
      .set({ prepayment: amount, prepaidAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, id));
  }
  refresh(id);
  return null;
}

// ── Фото й підпис ────────────────────────────────────────────────────

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function uploadPhoto(form: FormData): Promise<string | null> {
  await master();
  const id = field(form, "id");
  const slot = field(form, "slot");
  const file = form.get("file");
  if (!id || !["front", "back", "frame", "other"].includes(slot)) return null;
  if (!(file instanceof File) || file.size === 0) return "Оберіть фото.";
  if (!PHOTO_TYPES.includes(file.type)) return "Можна лише фото.";
  if (file.size > 6 * 1024 * 1024) return "Фото завелике — до 6 МБ.";

  const lead = await getLeadById(id);
  if (!lead) return null;

  const path = await savePhoto(`leads/${id}`, file);
  await getDb()
    .insert(leadPhotos)
    .values({ leadId: id, slot: slot as "front", path, stage: lead.stage });
  refresh(id);
  return null;
}

/** Підпис пальцем — PNG з полотна. Новий підпис того ж виду замінює старий. */
export async function saveSignature(form: FormData): Promise<string | null> {
  await master();
  const id = field(form, "id");
  const kind = field(form, "kind");
  const file = form.get("file");
  if (!id || (kind !== "intake" && kind !== "handover")) return null;
  if (!(file instanceof File) || file.type !== "image/png" || file.size === 0) return "Підпис не зберігся — спробуйте ще раз.";
  if (file.size > 1024 * 1024) return "Підпис завеликий.";

  const path = await savePhoto(`leads/${id}/sign`, file);
  await getDb()
    .insert(leadSignatures)
    .values({ leadId: id, kind, path })
    .onConflictDoUpdate({
      target: [leadSignatures.leadId, leadSignatures.kind],
      set: { path, createdAt: new Date() },
    });
  refresh(id);
  return null;
}

// ── Роботи й деталі ──────────────────────────────────────────────────

/**
 * Після зміни робіт: ціна клієнту = сума рядків, собівартість = сума cost.
 * Ці два поля й далі читають каса, кабінет і бот — тож тримаємо їх у лад.
 */
async function recountMoney(id: string) {
  const [row] = await getDb()
    .select({
      price: sql<number>`coalesce(sum(${leadItems.price}), 0)::int`,
      cost: sql<number | null>`sum(${leadItems.cost})::int`,
      n: count(),
    })
    .from(leadItems)
    .where(eq(leadItems.leadId, id));

  await getDb()
    .update(leads)
    .set({
      price: row.n > 0 ? row.price : null,
      partsCost: row.n > 0 ? row.cost : null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));
}

/** Після оплати ціну не міняємо мовчки — інакше «пливе» звіт за минулий місяць */
async function moneyLocked(id: string): Promise<boolean> {
  const lead = await getLeadById(id);
  return !lead || lead.paidAt !== null;
}

export async function addItem(form: FormData): Promise<string | null> {
  await master();
  const id = field(form, "id");
  const kind = field(form, "kind") === "part" ? "part" : "work";
  const title = plainText(field(form, "title"), LIMITS.short).trim();
  const price = Number(field(form, "price").replace(/\s/g, "") || "0");
  const costRaw = field(form, "cost").replace(/\s/g, "");
  const cost = costRaw === "" ? null : Number(costRaw);
  const partId = field(form, "partId") || null;

  if (!id) return null;
  if (await moneyLocked(id)) return "Заявку вже оплачено — суму не змінити.";
  if (!title) return kind === "work" ? "Впишіть, яку роботу робимо." : "Впишіть деталь.";
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) return "Ціна — ціле число гривень.";
  if (cost !== null && (!Number.isInteger(cost) || cost < 0 || cost > 1_000_000)) return "Собівартість — ціле число гривень.";

  // Деталь зі складу: собівартість — з закупівлі, якщо не вписали свою
  let unitCost = cost;
  if (partId) {
    const [part] = await getDb().select().from(parts).where(eq(parts.id, partId)).limit(1);
    if (!part) return "Такої деталі на складі немає.";
    unitCost = cost ?? part.unitCost;
  }

  await getDb().insert(leadItems).values({ leadId: id, kind, title, price, cost: unitCost, partId });
  await recountMoney(id);
  refresh(id);
  return null;
}

export async function removeItem(form: FormData): Promise<void> {
  await master();
  const id = field(form, "id");
  const itemId = field(form, "itemId");
  if (!id || !itemId || (await moneyLocked(id))) return;

  const [item] = await getDb()
    .delete(leadItems)
    .where(and(eq(leadItems.id, itemId), eq(leadItems.leadId, id)))
    .returning();
  // Деталь уже списали зі складу — повертаємо її на полицю
  if (item?.partId && item.writtenOffAt) {
    await getDb().update(parts).set({ qty: sql`${parts.qty} + 1` }).where(eq(parts.id, item.partId));
  }
  await recountMoney(id);
  refresh(id);
}

// ── Переходи ─────────────────────────────────────────────────────────

/** Чого бракує, щоб піти далі з поточного кроку. null — усе на місці. */
async function missing(lead: Lead, form: FormData): Promise<string | null> {
  if (lead.channel === "online") return null;

  switch (lead.stage) {
    case "new": {
      const [[photos], [sign]] = await Promise.all([
        getDb().select({ n: count() }).from(leadPhotos).where(eq(leadPhotos.leadId, lead.id)),
        getDb()
          .select({ n: count() })
          .from(leadSignatures)
          .where(and(eq(leadSignatures.leadId, lead.id), eq(leadSignatures.kind, "intake"))),
      ]);
      if (photos.n === 0 && sign.n === 0) return "Додайте хоча б одне фото й підпис клієнта";
      if (photos.n === 0) return "Додайте хоча б одне фото телефона";
      if (sign.n === 0) return "Потрібен підпис клієнта при прийомі";
      return null;
    }
    case "diagnostics": {
      const [works] = await getDb()
        .select({ n: count() })
        .from(leadItems)
        .where(and(eq(leadItems.leadId, lead.id), eq(leadItems.kind, "work")));
      return works.n === 0 ? "Додайте хоча б одну роботу з ціною" : null;
    }
    case "ready": {
      const checked = form.getAll("check").map(String);
      if (!CHECKS.every((c) => checked.includes(c))) return "Перевірте все перед видачею";
      if (!lead.paymentMethod) return "Оберіть, як клієнт платить";
      const [sign] = await getDb()
        .select({ n: count() })
        .from(leadSignatures)
        .where(and(eq(leadSignatures.leadId, lead.id), eq(leadSignatures.kind, "handover")));
      return sign.n === 0 ? "Потрібен підпис клієнта при видачі" : null;
    }
    default:
      return null;
  }
}

/** Наступний етап із картки. «Онлайн» іде коротким шляхом, як на дошці. */
function nextStage(lead: Lead): Lead["stage"] | null {
  if (lead.channel === "online") {
    return lead.stage === "ready" ? "issued" : lead.stage === "in_progress" ? "ready" : lead.stage === "issued" ? null : "in_progress";
  }
  const i = STAGE_ORDER.indexOf(lead.stage);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}

/**
 * Головна лаймова кнопка: Прийняти / Надіслати ціну / Клієнт погодив /
 * Ремонт готовий / Видати клієнту. Повертає текст помилки або null.
 */
export async function advance(_prev: string | null, form: FormData): Promise<string | null> {
  const me = await master();
  const id = field(form, "id");
  const lead = id ? await getLeadById(id) : undefined;
  if (!lead) return "Заявку не знайдено — можливо, її видалили.";
  if (lead.flag === "refused") return "Клієнт відмовився — спершу «Повернути».";
  if (lead.flag === "paused") return "Заявка на паузі — спершу «Продовжити».";

  const to = nextStage(lead);
  if (!to) return null;

  const problem = await missing(lead, form);
  if (problem) return problem;

  // Видача своїм клієнтам — через закриття заявки: гарантія, кабінет, повідомлення
  if (to === "issued" && lead.channel === "own") {
    await getDb()
      .update(leads)
      .set({ paidAt: lead.paidAt ?? new Date(), updatedAt: new Date() })
      .where(eq(leads.id, id));
    await addEvent(id, {
      text: `Перевірено перед видачею: ${CHECKS.join(", ")}`,
      stage: "issued",
      actor: me.email,
    });
    await closeOrder({ ...lead, paidAt: lead.paidAt ?? new Date() });
    refresh(id);
    return null;
  }

  const status = stageToStatus(to, null, lead.ttn);
  const moved = await getDb()
    .update(leads)
    .set({
      stage: to,
      status,
      assignee: lead.assignee ?? me.email,
      issuedAt: to === "issued" ? new Date() : lead.issuedAt,
      ...(to === "issued" ? onlineWarranty() : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, id), eq(leads.stage, lead.stage)))
    .returning();
  if (moved.length === 0) return null;
  const after = moved[0];

  // Клієнт погодив — деталі зі складу списуємо (раз; повторно не списуються)
  if (to === "in_progress") await writeOffParts(id);

  if (status !== lead.status) {
    await addEvent(id, { status, stage: to, actor: me.email });
    if (lead.channel === "own") {
      await notifyClientStatus(after);
      await pushStatusToClient(lead, status);
    }
  } else {
    await addEvent(id, { stage: to, actor: me.email });
  }

  // «Надіслати ціну» — клієнт отримує її в Telegram з кнопкою «Погоджуюсь»
  if (to === "approval" && lead.channel === "own") await offerPrice(after);

  refresh(id);
  return null;
}

/** Деталі зі складу в заявці — мінус одна на полиці, позначка «списано» */
async function writeOffParts(id: string) {
  const items = await getDb()
    .select()
    .from(leadItems)
    .where(and(eq(leadItems.leadId, id), isNull(leadItems.writtenOffAt)));
  for (const item of items) {
    if (!item.partId) continue;
    const done = await getDb()
      .update(leadItems)
      .set({ writtenOffAt: new Date() })
      .where(and(eq(leadItems.id, item.id), isNull(leadItems.writtenOffAt)))
      .returning({ id: leadItems.id });
    if (done.length > 0) {
      await getDb()
        .update(parts)
        .set({ qty: sql`greatest(0, ${parts.qty} - 1)` })
        .where(eq(parts.id, item.partId));
    }
  }
}

/** ‹ Назад — на попередній етап, без повідомлень клієнту (майстер виправляє свій крок) */
export async function back(form: FormData): Promise<void> {
  const me = await master();
  const id = field(form, "id");
  const lead = id ? await getLeadById(id) : undefined;
  if (!lead || lead.stage === "new" || lead.stage === "issued") return;

  const order = lead.channel === "online" ? (["new", "in_progress", "ready"] as const) : STAGE_ORDER;
  const i = (order as readonly Lead["stage"][]).indexOf(lead.stage);
  const to = i > 0 ? order[i - 1] : "new";
  await getDb()
    .update(leads)
    .set({ stage: to, status: stageToStatus(to, lead.flag, lead.ttn), updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.stage, lead.stage)));
  await addEvent(id, { text: `Повернули на крок назад`, stage: to, actor: me.email });
  refresh(id);
}

/** Пауза — бурштиновий банер «На паузі · …». Причина обовʼязкова. */
export async function pause(form: FormData): Promise<string | null> {
  const me = await master();
  const id = field(form, "id");
  const reason = plainText(field(form, "reason"), LIMITS.short).trim();
  if (!id) return null;
  if (!reason) return "Вкажіть, на що чекаємо.";
  const done = await getDb()
    .update(leads)
    .set({ flag: "paused", pauseReason: reason, updatedAt: new Date() })
    .where(and(eq(leads.id, id), isNull(leads.flag)))
    .returning({ id: leads.id });
  if (done.length > 0) await addEvent(id, { text: `Пауза: ${reason}`, actor: me.email });
  refresh(id);
  return null;
}

/**
 * Відмова клієнта — червоний банер. Для клієнта це «Заявку закрито»,
 * знижка повертається йому (як і раніше при відмові).
 */
export async function refuse(form: FormData): Promise<void> {
  const me = await master();
  const id = field(form, "id");
  const lead = id ? await getLeadById(id) : undefined;
  if (!lead || lead.flag === "refused" || lead.stage === "issued") return;

  await getDb()
    .update(leads)
    .set({ flag: "refused", pauseReason: null, status: "rejected", updatedAt: new Date() })
    .where(eq(leads.id, id));
  await releaseDiscount(lead);
  await addEvent(id, { status: "rejected", actor: me.email });
  if (lead.channel === "own") {
    await notifyClientStatus({ ...lead, status: "rejected" });
    await pushStatusToClient(lead, "rejected");
  }
  refresh(id);
}

/** «Повернути» після відмови — заявка знову активна на тому ж етапі */
export async function unrefuse(form: FormData): Promise<void> {
  const me = await master();
  const id = field(form, "id");
  const lead = id ? await getLeadById(id) : undefined;
  if (!lead || lead.flag !== "refused") return;

  const status = stageToStatus(lead.stage, null, lead.ttn);
  await getDb().update(leads).set({ flag: null, status, updatedAt: new Date() }).where(eq(leads.id, id));
  await addEvent(id, { text: "Відмову скасовано — ремонт продовжуємо", status, actor: me.email });
  refresh(id);
}
