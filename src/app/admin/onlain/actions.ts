"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, partnerPrices, partnerSettlements } from "@/db/schema";
import { getMonthLeads, getSettlement, isMonthKey, monthStartKyiv } from "@/db/online";
import { currentAdmin, isOwner } from "@/lib/admin";
import { isUuid, LIMITS, plainText, readUah } from "@/lib/validate";

/** Прайс магазину веде будь-який майстер; розрахунок (гроші) — лише власник */

async function master() {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");
  return me;
}

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

function readPrice(f: FormData): { model: string; work: string; price: number; cost: number | null } | string {
  const model = plainText(field(f, "model"), LIMITS.short).trim();
  const work = plainText(field(f, "work"), LIMITS.short).trim();
  const price = readUah(field(f, "price"));
  const cost = readUah(field(f, "cost"));
  if (!model) return "Впишіть модель.";
  if (!work) return "Впишіть роботу.";
  if (price === null || price === undefined || price === 0) return "Ціна — ціле число гривень, більше нуля.";
  if (cost === undefined) return "Собівартість — ціле число гривень.";
  return { model, work, price, cost };
}

export async function addPrice(_prev: string | null, f: FormData): Promise<string | null> {
  await master();
  const p = readPrice(f);
  if (typeof p === "string") return p;
  await getDb().insert(partnerPrices).values(p);
  revalidatePath("/admin", "layout");
  return null;
}

/**
 * Нова ціна діє на нові заявки. Ті, що вже прийняті, лишаються з ціною,
 * за якою їх приймали, — інакше «поплив» би вже погоджений з магазином розрахунок.
 */
export async function updatePrice(_prev: string | null, f: FormData): Promise<string | null> {
  await master();
  const id = field(f, "id");
  const p = readPrice(f);
  if (typeof p === "string") return p;
  if (!isUuid(id)) return null;
  await getDb().update(partnerPrices).set(p).where(eq(partnerPrices.id, id));
  revalidatePath("/admin", "layout");
  return null;
}

/** Прибрати / повернути позицію. Не видаляємо: старі заявки на неї посилаються в історії. */
export async function togglePrice(f: FormData): Promise<void> {
  await master();
  const id = field(f, "id");
  const active = field(f, "active") === "1";
  if (!isUuid(id)) return;
  await getDb().update(partnerPrices).set({ active }).where(eq(partnerPrices.id, id));
  revalidatePath("/admin", "layout");
}

/**
 * «Магазин оплатив» за місяць: фіксуємо, скільки телефонів і на яку суму,
 * скільки магазин утримав, і привʼязуємо ці заявки до розрахунку.
 */
export async function markPaid(_prev: string | null, f: FormData): Promise<string | null> {
  await master();
  if (!(await isOwner())) return "Розрахунок із магазином веде власник.";

  const month = field(f, "month");
  if (!isMonthKey(month)) return null;
  const fee = readUah(field(f, "fee"));
  if (fee === undefined) return "Утримання — ціле число гривень.";

  if (await getSettlement(month)) return "Цей місяць уже закрито.";
  const rows = await getMonthLeads(month);
  if (rows.length === 0) return "За цей місяць магазину нічого не віддавали.";

  const amount = rows.reduce((s, r) => s + (r.price ?? 0), 0);
  if ((fee ?? 0) > amount) return "Утримання не може бути більше за суму.";

  const [settlement] = await getDb()
    .insert(partnerSettlements)
    .values({ periodStart: monthStartKyiv(month), ordersCount: rows.length, amount, fee: fee ?? 0, paidAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: partnerSettlements.id });
  if (!settlement) return "Цей місяць уже закрито.";

  await getDb()
    .update(leads)
    .set({ settlementId: settlement.id })
    .where(and(inArray(leads.id, rows.map((r) => r.id)), isNull(leads.settlementId)));

  revalidatePath("/admin", "layout");
  return null;
}
