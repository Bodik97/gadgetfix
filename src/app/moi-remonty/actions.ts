"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { addEvent } from "@/db/events";
import { describeStatus, getClientLeads } from "@/db/leads";
import { leads } from "@/db/schema";
import { leadLink } from "@/lib/adminLinks";
import { alertMasters } from "@/lib/notify";
import { siteUrl } from "@/lib/siteUrl";
import { esc } from "@/lib/telegram";
import { verifiedEmail } from "@/lib/verifiedEmail";

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
    const mine = await getClientLeads(user.id, verifiedEmail(user));
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

export type ReceivedResult = { ok: true } | { ok: false; error: string };

/**
 * Клієнт підтверджує, що пристрій уже в нього. Заявку не закриваємо — це
 * робить майстер разом з оплатою й гарантією, — лише відмічаємо й кличемо
 * майстра. Повторне натискання нічого не змінює.
 */
export async function confirmReceived(id: string): Promise<ReceivedResult> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "Увійдіть у свій акаунт ще раз." };
  }

  try {
    const mine = await getClientLeads(user.id, verifiedEmail(user));
    const lead = mine.find((l) => l.id === id);
    if (!lead) {
      return { ok: false, error: "Не знайшли цю заявку серед ваших. Оновіть сторінку." };
    }
    if (lead.receivedAt) return { ok: true };

    // Отримати можна лише те, що вже готове чи відправлене
    const s = describeStatus(lead.status);
    if (!s.active || !s.finished) {
      return { ok: false, error: "Пристрій ще в роботі — підтвердити отримання можна, коли він буде готовий." };
    }

    const marked = await getDb()
      .update(leads)
      .set({ receivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(leads.id, lead.id), isNull(leads.receivedAt)))
      .returning({ id: leads.id });

    // Інша вкладка встигла раніше — хроніку й сигнал не дублюємо
    if (marked.length > 0) {
      await addEvent(lead.id, { text: "Клієнт підтвердив, що отримав пристрій." });

      await alertMasters(
        {
          title: `№${lead.orderNo} · клієнт отримав пристрій`,
          body: `${lead.name} — можна закривати заявку`.slice(0, 160),
          url: leadLink(lead.orderNo, lead.id),
          tag: `received-${lead.id}`,
        },
        `<b>Клієнт підтвердив отримання</b>\n№${lead.orderNo} · ${esc(lead.name)}\n\nМожна закривати заявку: оплата й гарантія.\n${siteUrl()}/admin/zayavky`,
      );
    }

    revalidatePath("/moi-remonty");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    console.error("[received] підтвердження не збережено:", e);
    return { ok: false, error: "Не вдалося зберегти. Спробуйте ще раз або зателефонуйте нам." };
  }
}
