"use server";

import { revalidatePath } from "next/cache";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { BIRTHDAY_RE } from "@/data/discounts";
import { extrasOf } from "@/lib/profile";
import { normalizeUaPhone } from "@/lib/phone";

export type ProfileResult = { ok: true } | { ok: false; error: string };

/** Телефон без SMS: зберігаємо, щоб підставляти в замовлення. Порожній — прибрати */
export async function saveProfilePhone(raw: string): Promise<ProfileResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Увійдіть у кабінет ще раз." };

  const phone = raw.trim() ? normalizeUaPhone(raw) : null;
  if (raw.trim() && !phone) return { ok: false, error: "Перевірте номер: після +38 — 10 цифр, починаючи з 0." };

  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(user.id, { publicMetadata: { phone } });
  revalidatePath("/profil");
  revalidatePath("/moi-remonty");
  return { ok: true };
}

/**
 * Дата народження — один раз: від неї залежить знижка, тож переписати її
 * заради знижки не можна. Помилилися — виправляє майстер.
 */
export async function saveBirthday(date: string): Promise<ProfileResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Увійдіть у кабінет ще раз." };
  if (extrasOf(user).birthday) return { ok: false, error: "Дату вже вказано. Помилилися — напишіть майстру." };

  if (!BIRTHDAY_RE.test(date)) return { ok: false, error: "Оберіть дату народження." };
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  // 31 лютого JS тихо перетворив би на 3 березня — така дата не справжня
  if (day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return { ok: false, error: "Такої дати не буває." };
  const age = new Date().getUTCFullYear() - y;
  if (age < 6 || age > 110) return { ok: false, error: "Перевірте рік народження." };

  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(user.id, { publicMetadata: { birthday: date } });
  revalidatePath("/profil");
  revalidatePath("/moi-remonty");
  revalidatePath("/moi-znyzhky");
  return { ok: true };
}
