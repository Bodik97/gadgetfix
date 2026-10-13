import { timingSafeEqual } from "node:crypto";
import {
  CHECK_BUTTON,
  SHARE_BUTTON,
  callBot,
  chatLeads,
  downloadPhoto,
  linkChat,
  readStart,
  sendToChat,
  statusReport,
  subjectOfPhone,
  webhookSecret,
} from "@/lib/clientBot";
import { addEvent, getEvents } from "@/db/events";
import { put } from "@vercel/blob";
import { addMessage, MAX_MESSAGE } from "@/db/messages";
import type { Lead } from "@/db/schema";
import { ARCHIVED } from "@/data/leadStatus";
import { site } from "@/data/site";
import { leadLink } from "@/lib/adminLinks";
import { closeOrder } from "@/lib/handover";
import { alertMasters } from "@/lib/notify";
import { rateLimit } from "@/lib/rateLimit";
import { siteUrl } from "@/lib/siteUrl";
import { esc } from "@/lib/telegram";

export const dynamic = "force-dynamic";

type Update = {
  message?: {
    text?: unknown;
    caption?: unknown;
    /** Те саме фото в кількох розмірах, найбільше — останнє */
    photo?: { file_id: string; width?: number; height?: number; file_size?: number }[];
    from?: { id?: number };
    chat?: { id?: number; type?: string };
    contact?: { phone_number?: unknown; user_id?: number };
  };
  callback_query?: {
    id: string;
    data?: unknown;
    message?: { message_id?: number; chat?: { id?: number; type?: string } };
  };
};

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;

/** Та сама межа, що й для фото з чату на сайті */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

type Image = { imagePath: string; imageWidth: number | null; imageHeight: number | null };

/**
 * Те, що клієнт сказав боту, майстер має побачити так само, як повідомлення
 * з чату на сайті: запис у чаті заявки (звідси лічильник і сигнал на огляді)
 * плюс сповіщення на телефон.
 */
async function passToMasters(lead: Lead, text: string, image?: Image): Promise<void> {
  await addMessage(lead.id, "client", { text, ...image });
  await alertMasters(
    {
      title: `№${lead.orderNo} · ${lead.name} пише`,
      body: text ? text.slice(0, 160) : "Надіслав фото",
      url: leadLink(lead.orderNo, lead.id),
      tag: `chat-${lead.id}`,
    },
    `<b>Повідомлення від клієнта (Telegram)</b>\n№${lead.orderNo} · ${esc(lead.name)}\n\n${text ? esc(text) : "надіслав фото"}\n\n${siteUrl()}/admin/zayavky`,
  );
}

/** Фото від клієнта — у те саме приватне сховище, що й фото з чату на сайті */
async function savePhoto(lead: Lead, photo: NonNullable<NonNullable<Update["message"]>["photo"]>): Promise<Image | null> {
  const best = photo[photo.length - 1];
  if (!best?.file_id || (best.file_size ?? 0) > MAX_IMAGE_BYTES) return null;

  const file = await downloadPhoto(best.file_id);
  if (!file || file.size > MAX_IMAGE_BYTES) return null;

  // Telegram перетискає фото в JPEG, хай що надіслав клієнт
  const blob = await put(`chat/${lead.id}/${crypto.randomUUID()}`, file, { access: "private", contentType: "image/jpeg" });
  return { imagePath: blob.pathname, imageWidth: best.width ?? null, imageHeight: best.height ?? null };
}

/**
 * Кнопки під повідомленнями бота: під ціною — «Погоджуюсь» / «Передзвоніть
 * мені», під відправкою — «Я отримав посилку».
 */
async function onButton(query: NonNullable<Update["callback_query"]>): Promise<void> {
  const chat = query.message?.chat;
  const match = /^(?:(ok|call):([0-9a-f]{32}):(\d+)|(got):([0-9a-f]{32}))$/.exec(
    typeof query.data === "string" ? query.data : "",
  );

  const answer = (text: string) => callBot("answerCallbackQuery", { callback_query_id: query.id, text });

  if (!match || chat?.id === undefined || chat.type !== "private") {
    await answer("Кнопка застаріла.");
    return;
  }

  const chatId = String(chat.id);
  const action = match[1] ?? match[4];
  const leadKey = match[2] ?? match[5];
  const price = Number(match[3]);

  // Заявку шукаємо лише серед тих, що закріплені за цим чатом — чужу кнопкою не зачепити
  const lead = (await chatLeads(chatId))?.find((l) => l.id.replace(/-/g, "") === leadKey);
  if (!lead) {
    await answer("Не знайшли цю заявку.");
    return;
  }

  // Кнопки прибираємо одразу: вдруге натиснути ту саму не можна
  await callBot("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: query.message?.message_id,
    reply_markup: { inline_keyboard: [] },
  });

  if (action === "got") {
    // Закрити можна лише посилку в дорозі: решту вже закрили майстер або Нова Пошта
    if (lead.status !== "shipped") {
      await answer("Заявку вже закрито.");
      return;
    }
    await answer("Дякуємо!");
    // Закриття саме пише клієнту «Завершено» з датою, до якої діє гарантія
    await closeOrder(lead, "Клієнт підтвердив, що отримав посилку");
    return;
  }

  if (lead.price !== price) {
    await answer("Ціна змінилась — дивіться свіжіше повідомлення.");
    return;
  }

  if (action === "ok") {
    const approved = `Клієнт погодив ціну: ${price} ₴`;
    // Telegram може принести те саме натискання двічі. Якщо останнє погодження
    // в хроніці — саме ця ціна, удруге не пишемо ні в хроніку, ні майстру
    const last = (await getEvents(lead.id)).findLast((e) => e.text.startsWith("Клієнт погодив ціну:"));
    if (last?.text === approved) {
      await answer("Дякуємо!");
      return;
    }

    await addEvent(lead.id, { text: approved });
    await passToMasters(lead, `Погоджуюсь на ціну ${uah(price)}`);
    await answer("Дякуємо!");
    await sendToChat(chatId, `Дякуємо, ціну ${uah(price)} погоджено. Про наступні етапи напишемо сюди.`);
  } else {
    await passToMasters(lead, `Прошу передзвонити щодо ціни ${uah(price)}`);
    await answer("Передали майстру.");
    await sendToChat(chatId, "Передали майстру — він вам передзвонить.");
  }
}

/**
 * Webhook клієнтського бота: сюди Telegram приносить те, що людина написала
 * боту. Чат закріплюємо за клієнтом двома шляхами: «Start» за посиланням із
 * сайту чи квитанції або кнопка «Поділитися номером» просто в боті — без
 * сайту й реєстрації. Далі статуси ремонту йдуть у цей чат самі, кнопка
 * «Перевірити статус» показує поточний стан, а будь-який інший текст
 * потрапляє майстру в чат заявки.
 *
 * Telegram чекає 200 на будь-яке оновлення, інакше повторює його знову й знову.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = webhookSecret();
  // Порівнюємо за сталий час: звичайне «!==» видає, скільки символів збіглося
  const given = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const expected = Buffer.from(secret ?? "");
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Немає доступу", { status: 403 });
  }

  const update = (await request.json().catch(() => null)) as Update | null;

  if (update?.callback_query) {
    await onButton(update.callback_query).catch((e) => console.error("[client-bot] кнопка:", e));
    return new Response("ok");
  }

  const message = update?.message;
  const chat = message?.chat;
  const text = typeof message?.text === "string" ? message.text.trim() : "";

  // Лише особисті чати: у групі статуси чужого ремонту ні до чого
  if (chat?.id === undefined || chat.type !== "private") return new Response("ok");
  const chatId = String(chat.id);

  const report = () =>
    statusReport(chatId).catch((e) => {
      console.error("[client-bot] статус не зібрано:", e);
      return null;
    });

  // Номер із кнопки «Поділитися номером». Приймаємо лише власний контакт:
  // чужий можна переслати вручну, і тоді прийшли б статуси чужого ремонту
  const contact = message?.contact;
  if (contact) {
    const own = contact.user_id !== undefined && contact.user_id === message?.from?.id;
    const subject = own && typeof contact.phone_number === "string" ? subjectOfPhone(contact.phone_number) : null;

    if (!subject) {
      await sendToChat(chatId, `Потрібен саме ваш номер — натисніть кнопку «${SHARE_BUTTON}» нижче.`, "share");
      return new Response("ok");
    }

    await linkChat(subject, chatId);
    await sendToChat(
      chatId,
      `<b>Готово — статуси підключено.</b>\nСюди прийде повідомлення щоразу, коли зміниться етап вашого ремонту в ${site.name}.\n\n${(await report()) ?? ""}`,
    );
    return new Response("ok");
  }

  const payload = /^\/start(?:@\w+)?\s+(\S+)/.exec(text)?.[1];
  const subject = payload ? readStart(payload) : null;

  // За посиланням чат закріплюється лише за однією заявкою (чи акаунтом).
  // Старі посилання «на телефон» не приймаємо: номер у формі на сайті міг
  // вписати будь-хто, і таке посилання перехопило б сповіщення справжнього
  // власника. Далі бот попросить поділитися номером — це єдиний шлях до телефону
  if (subject && subject[0] !== "t") {
    await linkChat(subject, chatId);
    await sendToChat(
      chatId,
      `<b>Готово — статуси підключено.</b>\nСюди прийде повідомлення щоразу, коли зміниться етап вашого ремонту в ${site.name}. Поточний стан — кнопкою «${CHECK_BUTTON}».`,
    );
    return new Response("ok");
  }

  const mine = await chatLeads(chatId).catch((e) => {
    console.error("[client-bot] заявки не знайдено:", e);
    return null;
  });

  // Ще не знаємо, хто це: просимо номер — за ним знайдемо заявки
  if (!mine) {
    await sendToChat(
      chatId,
      `Щоб побачити статус ремонту, натисніть «${SHARE_BUTTON}» нижче. Знайдемо ваші заявки за номером телефону й надалі писатимемо сюди про кожну зміну.`,
      "share",
    );
    return new Response("ok");
  }

  const photo = Array.isArray(message?.photo) && message.photo.length > 0 ? message.photo : null;

  // Кнопка чи команда — показуємо стан ремонтів
  if (!photo && (!text || text === CHECK_BUTTON || text.startsWith("/"))) {
    await sendToChat(chatId, (await report()) ?? "Не вдалося показати статус. Спробуйте, будь ласка, трохи пізніше.");
    return new Response("ok");
  }

  // Звичайний текст чи фото — це повідомлення майстру: у чат найсвіжішої незакритої заявки
  const lead = mine.find((l) => !ARCHIVED.includes(l.status)) ?? mine[0];
  if (!lead) {
    await sendToChat(chatId, "Активних ремонтів за вашим номером зараз немає, тож передати повідомлення нікому.");
    return new Response("ok");
  }

  const limit = await rateLimit(`bot:chat:${chatId}`, 20, 60_000);
  if (!limit.ok) {
    await sendToChat(chatId, "Забагато повідомлень поспіль. Трохи зачекайте.");
    return new Response("ok");
  }

  if (photo) {
    const image = await savePhoto(lead, photo).catch((e) => {
      console.error("[client-bot] фото не збережено:", e);
      return null;
    });

    if (!image) {
      await sendToChat(chatId, "Не вдалося прийняти фото. Спробуйте ще раз або надішліть його в чаті заявки на сайті.");
      return new Response("ok");
    }

    // Підпис під фото — це текст того самого повідомлення
    const caption = typeof message?.caption === "string" ? message.caption.trim().slice(0, MAX_MESSAGE) : "";
    await passToMasters(lead, caption, image);
  } else {
    await passToMasters(lead, text);
  }

  await sendToChat(chatId, `Передали майстру (замовлення №${lead.orderNo}). Відповідь прийде сюди.`);

  return new Response("ok");
}
