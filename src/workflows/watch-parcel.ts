import { sleep } from "workflow";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { closeOrder } from "@/lib/handover";
import { parcelReceived } from "@/lib/novaPoshta";

/**
 * Відправлена заявка закривається сама, щойно клієнт забере посилку.
 *
 * Гарантія рахується від дня, коли пристрій у клієнта, а не від дня
 * відправки. Тож раз на кілька годин питаємо Нову Пошту про накладну. Клієнт
 * може випередити нас кнопкою в боті, майстер — в адмінці; тоді заявка вже
 * не «Відправлено», і стеження тихо припиняється.
 *
 * Чекання — sleep() Workflow: поки спить, функція не працює й нічого не коштує.
 */

/** Перевірка раз на 4 години впродовж 3 тижнів: довше посилка на пошті не лежить */
const EVERY = "4h";
const CHECKS = 6 * 21;

/** "closed" — отримано й закрито, "stop" — стежити вже не треба, "wait" — ще в дорозі */
export async function checkParcel(leadId: string, ttn: string): Promise<"closed" | "stop" | "wait"> {
  "use step";
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, leadId)).limit(1);
  // Накладну замінили або заявку видалили — це стеження зайве
  if (!lead || lead.ttn !== ttn) return "stop";

  // Заявку вже закрито — нами ж, якщо це повтор кроку після збою посеред
  // закриття, або клієнтом чи майстром. closeOrder доробить те, чого бракує
  // (подія, пристрій, повідомлення), а де все на місці — нічого не змінить
  if (lead.status === "done") {
    await closeOrder(lead);
    return "stop";
  }

  if (lead.status !== "shipped") return "stop";

  if (!(await parcelReceived(ttn))) return "wait";

  await closeOrder(lead, "Посилку отримано на Новій Пошті");
  return "closed";
}

export async function watchParcel(leadId: string, ttn: string) {
  "use workflow";

  for (let i = 0; i < CHECKS; i++) {
    await sleep(EVERY);
    const state = await checkParcel(leadId, ttn);
    if (state !== "wait") return { state, checks: i + 1 };
  }

  return { state: "gave up", checks: CHECKS };
}
