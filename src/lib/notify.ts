import "server-only";
import { adminDirectory } from "./admin";
import { sendPush, type PushPayload } from "./push";
import { notifyMaster } from "./telegram";

/**
 * Сповістити майстрів: спершу push на телефони, і якщо хоч до одного з
 * майстрів він не дійшов (не ввімкнув сповіщення, ключі не задані, збій) —
 * ще й Telegram, як було до push. Так сповіщення не губиться на перехідний час.
 *
 * Раніше Telegram мовчав, щойно push прийняв хоч один телефон, — і майстер
 * без push не дізнавався ні про повідомлення клієнта, ні про новий відгук.
 * Написати в Telegram лише йому не можемо: чати там — спільний список, без
 * привʼязки до майстра. Тому в такому разі пишемо всім.
 *
 * `telegramHtml` — той самий зміст у розмітці Telegram.
 */
export async function alertMasters(push: PushPayload, telegramHtml: string): Promise<"push" | "telegram"> {
  const team = adminDirectory();

  const reached = await Promise.all(
    team.map((master) =>
      sendPush(push, [master.email]).catch((e) => {
        console.error("[notify] push упав:", e);
        return 0;
      }),
    ),
  );

  if (team.length > 0 && reached.every((delivered) => delivered > 0)) return "push";

  await notifyMaster(telegramHtml);
  return "telegram";
}
