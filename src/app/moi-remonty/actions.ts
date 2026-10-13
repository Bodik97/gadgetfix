"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { describeStatus, getClientLeads } from "@/db/leads";
import { leads } from "@/db/schema";
import { leadLink } from "@/lib/adminLinks";
import { alertMasters } from "@/lib/notify";
import { siteUrl } from "@/lib/siteUrl";
import { esc } from "@/lib/telegram";

export type DeliveryResult = { ok: true } | { ok: false; error: string };

/**
 * Клієнт просить надіслати готовий пристрій Новою Поштою.
 * Оновлюємо тільки заявку цього клієнта. Свою шукаємо так само, як сторінка
 * кабінету — за акаунтом і за поштою: заявка могла бути залишена до реєстрації.
 */
export async function requestDelivery(_prev: DeliveryResult | null, formData: FormData): Promise<DeliveryResult> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "Щоб замовити відправку, увійдіть у свій акаунт ще раз." };
  }

  const id = String(formData.get("id") ?? "");
  const address = String(formData.get("address") ?? "").trim().slice(0, 300);
  if (!id || address.length < 5) {
    return { ok: false, error: "Впишіть місто й номер відділення Нової Пошти." };
  }

  try {
    const mine = await getClientLeads(user.id, user.primaryEmailAddress?.emailAddress);
    const lead = mine.find((l) => l.id === id);
    if (!lead) {
      return { ok: false, error: "Не знайшли цю заявку серед ваших. Оновіть сторінку або зателефонуйте нам." };
    }

    // Завершену чи закриту заявку вже нікуди відправляти
    if (!describeStatus(lead.status).active) {
      return { ok: false, error: "Цю заявку вже закрито — відправку замовити не можна. Зателефонуйте нам, якщо це помилка." };
    }

    await getDb()
      .update(leads)
      .set({
        deliveryRequested: true,
        deliveryAddress: address,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    revalidatePath("/moi-remonty");

    // Без сигналу запит пролежав би, доки майстер сам не відкриє заявку
    await alertMasters(
      {
        title: `№${lead.orderNo} · просить надіслати поштою`,
        body: `${lead.name} · ${address}`.slice(0, 160),
        url: leadLink(lead.orderNo, lead.id),
        tag: `delivery-${lead.id}`,
      },
      `<b>Клієнт просить надіслати поштою</b>\n№${lead.orderNo} · ${esc(lead.name)}\n\n${esc(address)}\n\n${siteUrl()}/admin/zayavky`,
    );

    return { ok: true };
  } catch (e) {
    console.error("[delivery] запит на відправку не збережено:", e);
    return { ok: false, error: "Не вдалося зберегти запит. Спробуйте ще раз або зателефонуйте нам." };
  }
}
