import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { leadEvents, leads, telegramChats, type Lead } from "@/db/schema";

/**
 * Бот для клієнтів. Головне: чат закріплюється лише за посиланням із нашим
 * підписом, статус іде тільки тому, хто підключився, а збій Telegram не
 * ламає зміну статусу в адмінці.
 */

vi.mock("@/db", async () => {
  const { claimingDb } = await import("./helpers/claimingDb");
  return { getDb: () => claimingDb };
});

// Справжній обмежувач рахує рядки в базі — тут він лише заважав би
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ ok: true }) }));

const uploaded: { path: string; size: number }[] = [];
vi.mock("@vercel/blob", () => ({
  put: async (path: string, file: Blob) => {
    uploaded.push({ path, size: file.size });
    return { pathname: path };
  },
}));

import * as bot from "@/lib/clientBot";
import { POST } from "@/app/api/telegram/client/route";

const LEAD = {
  id: "11111111-1111-1111-1111-111111111111",
  orderNo: 1001,
  name: "Олег",
  phone: "073 315 02 38",
  clerkUserId: null,
  model: "iPhone 13",
  service: null,
  status: "ready",
  ttn: null,
} as unknown as Lead;

const CHAT = { id: "c1", subject: "t733150238", chatId: "555", createdAt: new Date() };
/** Запис чату, закріпленого лише за заявкою LEAD */
const LEAD_SUBJECT = "l11111111111111111111111111111111";

type Sent = {
  chat_id: string;
  text: string;
  reply_markup: {
    keyboard: { text: string; request_contact?: boolean }[][];
    inline_keyboard: { text: string; callback_data: string }[][];
  };
};
/** Лише надіслані повідомлення; решта викликів Bot API — у `calls` */
let sent: Sent[] = [];
let calls: { method: string; body: Record<string, unknown> }[] = [];
let telegramStatus = 200;

beforeEach(() => {
  fake.reset();
  sent = [];
  telegramStatus = 200;
  vi.stubEnv("TELEGRAM_CLIENT_BOT_TOKEN", "123:token");
  vi.stubEnv("TELEGRAM_CLIENT_BOT_USERNAME", "@GadgetFixStatusBot");
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init: { body: string | FormData }) => {
    const method = url.slice(url.lastIndexOf("/") + 1);
    // sendPhoto йде формою з файлом, решта — JSON
    const body = typeof init.body === "string" ? JSON.parse(init.body) : Object.fromEntries(init.body as FormData);
    calls.push({ method, body });
    if (method === "sendMessage") sent.push(body);
    return new Response("{}", { status: telegramStatus });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const payloadOf = (link: string) => new URL(link).searchParams.get("start")!;

describe("посилання на бота", () => {
  it("закріплює чат за телефоном, як би його не записали", () => {
    expect(bot.subjectOf(LEAD)).toBe("t733150238");
    expect(bot.subjectOf({ ...LEAD, phone: "+380733150238" })).toBe("t733150238");
  });

  it("без телефону — за акаунтом, без акаунта — за заявкою", () => {
    expect(bot.subjectOf({ ...LEAD, phone: null, clerkUserId: "user_2abc" })).toBe("uuser_2abc");
    expect(bot.subjectOf({ ...LEAD, phone: null })).toBe("l11111111111111111111111111111111");
  });

  it("веде в бота й уміщається в ліміт Telegram на параметр start", () => {
    const link = bot.connectLink(LEAD)!;
    expect(link.startsWith("https://t.me/GadgetFixStatusBot?start=")).toBe(true);
    expect(payloadOf(link)).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("посилання закріплює чат лише за заявкою, навіть коли в ній є телефон", () => {
    const payload = payloadOf(bot.connectLink(LEAD)!);
    expect(payload.startsWith(`${LEAD_SUBJECT}-`)).toBe(true);
    expect(payload).not.toContain("733150238");
  });

  it("підпис звіряється: своє посилання читається, підроблене — ні", () => {
    const payload = payloadOf(bot.connectLink(LEAD)!);
    expect(bot.readStart(payload)).toBe(LEAD_SUBJECT);
    expect(bot.readStart(payload.replace(LEAD_SUBJECT, "l" + "2".repeat(32)))).toBeNull();
    expect(bot.readStart(payload.replace(LEAD_SUBJECT, "t733150238"))).toBeNull();
    expect(bot.readStart(LEAD_SUBJECT)).toBeNull();
  });

  it("бот не налаштований — посилання немає", () => {
    vi.stubEnv("TELEGRAM_CLIENT_BOT_TOKEN", "");
    expect(bot.connectLink(LEAD)).toBeNull();
    expect(bot.clientBotReady()).toBe(false);
  });
});

describe("повідомлення про статус", () => {
  it("у тексті номер, пристрій, етап і накладна для відправленого", () => {
    const text = bot.statusText({ ...LEAD, status: "shipped", ttn: "20450000000000" });
    expect(text).toContain("Замовлення №1001 — Відправлено");
    expect(text).toContain("iPhone 13");
    expect(text).toContain("20450000000000");
  });

  it("після видачі бот називає дату, до якої діє гарантія", () => {
    const text = bot.statusText({ ...LEAD, status: "done", warrantyUntil: new Date("2027-04-10T09:00:00Z") });
    expect(text).toContain("Гарантія діє до 10 квітня 2027");
  });

  it("іде в чат клієнта, який підключив бота", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    expect(await bot.notifyClientStatus(LEAD)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].chat_id).toBe("555");
    expect(sent[0].text).toContain("Готово");
  });

  it("іде й тому, хто підключився за посиланням лише до цієї заявки", async () => {
    fake.onSelect(telegramChats, (q) =>
      q.params.includes(LEAD_SUBJECT) ? [{ id: "c2", subject: LEAD_SUBJECT, chatId: "900", createdAt: new Date() }] : [],
    );
    expect(await bot.notifyClientStatus(LEAD)).toBe(true);
    expect(sent.map((s) => s.chat_id)).toEqual(["900"]);
  });

  it("підключені і за телефоном, і за заявкою — отримують обидва чати, той самий чат — один раз", async () => {
    fake.onSelect(telegramChats, () => [
      CHAT,
      { id: "c2", subject: LEAD_SUBJECT, chatId: "900", createdAt: new Date() },
      { id: "c3", subject: LEAD_SUBJECT, chatId: "555", createdAt: new Date() },
    ]);
    expect(await bot.notifyClientStatus(LEAD)).toBe(true);
    expect(sent.map((s) => s.chat_id)).toEqual(["555", "900"]);
  });

  it("позначка «бот підключений» в адмінці бачить і чат за заявкою", async () => {
    const other = { ...LEAD, id: "22222222-2222-2222-2222-222222222222", phone: "050 123 45 67" };
    fake.onSelect(telegramChats, () => [{ subject: LEAD_SUBJECT }]);
    expect(await bot.linkedLeads([LEAD, other])).toEqual(new Set([LEAD.id]));
  });

  it("не підключив — нічого не шлемо", async () => {
    expect(await bot.notifyClientStatus(LEAD)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("про «Нову» не пишемо — клієнт щойно сам лишив заявку", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    expect(await bot.notifyClientStatus({ ...LEAD, status: "new" })).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("клієнт зупинив бота — запис прибираємо", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    telegramStatus = 403;
    expect(await bot.notifyClientStatus(LEAD)).toBe(false);
    expect(fake.writes().some((q) => /^delete from "telegram_chats"/.test(q.sql))).toBe(true);
  });

  it("Telegram недоступний — помилка не виходить назовні", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    vi.stubGlobal("fetch", async () => {
      throw new Error("network");
    });
    expect(await bot.notifyClientStatus(LEAD)).toBe(false);
  });
});

describe("webhook бота", () => {
  const update = (text: string, type = "private") =>
    new Request("http://localhost/api/telegram/client", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": bot.webhookSecret()! },
      body: JSON.stringify({ message: { text, chat: { id: 555, type } } }),
    });

  it("без секрету Telegram запит відхиляється", async () => {
    const res = await POST(new Request("http://localhost/api/telegram/client", { method: "POST", body: "{}" }));
    expect(res.status).toBe(403);
    expect(fake.writes()).toHaveLength(0);
  });

  it("чужий секрет тієї ж довжини відхиляється", async () => {
    const res = await POST(
      new Request("http://localhost/api/telegram/client", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "0".repeat(bot.webhookSecret()!.length) },
        body: JSON.stringify({ message: { text: "/status", chat: { id: 555, type: "private" } } }),
      }),
    );
    expect(res.status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it("Start за нашим посиланням закріплює чат за заявкою і підтверджує клієнту", async () => {
    // Після запису бот перевіряє, чий чат закріплено за заявкою, — тепер цей
    fake.onSelect(telegramChats, () => [{ chatId: "555" }]);
    const res = await POST(update(`/start ${payloadOf(bot.connectLink(LEAD)!)}`));
    expect(res.status).toBe(200);

    const [insert] = fake.writes();
    expect(insert.sql).toMatch(/^insert into "telegram_chats"/);
    expect(insert.params).toEqual(expect.arrayContaining([LEAD_SUBJECT, "555"]));
    expect(insert.params).not.toContain("t733150238");
    expect(sent[0].text).toContain("статуси підключено");
  });

  it("посилання потрапило до чужої людини — підключений чат власника не відбираємо", async () => {
    // За заявкою вже закріплено інший чат: insert … on conflict do nothing його не чіпає
    fake.onSelect(telegramChats, () => [{ chatId: "777" }]);
    const res = await POST(update(`/start ${payloadOf(bot.connectLink(LEAD)!)}`));
    expect(res.status).toBe(200);
    expect(fake.writes().some((q) => /on conflict .* do update/i.test(q.sql))).toBe(false);
    expect(sent[0].text).toContain("вже підключена до іншого Telegram");
  });

  /** Посилання старого зразка — «на телефон»: такі роздавав сайт раніше */
  const oldPhoneLink = (subject: string) =>
    // Підпис рахуємо так само, як бот, — тим самим токеном
    `${subject}-${createHmac("sha256", "123:token").update(subject).digest("hex").slice(0, 20)}`;

  it("старе посилання «на телефон» чат не закріплює — бот просить поділитися номером", async () => {
    // Підпис справжній: без перевірки виду запису таке посилання спрацювало б
    expect(bot.readStart(oldPhoneLink("t733150238"))).toBe("t733150238");

    await POST(update(`/start ${oldPhoneLink("t733150238")}`));
    expect(fake.writes()).toHaveLength(0);
    expect(sent[0].reply_markup.keyboard[0][0]).toEqual({ text: bot.SHARE_BUTTON, request_contact: true });
  });

  it("чужий номер у заявці: посилання не перехоплює чат власника номера й показує лише цю заявку", async () => {
    // Власник номера давно підключений за телефоном (чат 777) і має свій ремонт
    const victimChat = { id: "c7", subject: "t733150238", chatId: "777", createdAt: new Date() };
    const victimLead = { ...LEAD, orderNo: 1001, status: "in_progress", createdAt: new Date() };
    // Сторонній лишив на сайті заявку з його номером і відкрив видане посилання (чат 555)
    const planted = { ...LEAD, id: "22222222-2222-2222-2222-222222222222", orderNo: 2002, status: "in_progress", createdAt: new Date() };
    const plantedSubject = "l22222222222222222222222222222222";

    const chats = [victimChat];
    fake.onSelect(telegramChats, (q) => chats.filter((c) => q.params.includes(c.subject) || q.params.includes(c.chatId)));
    fake.onSelect(leads, (q) =>
      [victimLead, planted].filter((l) => q.params.includes(l.id) || q.params.includes("733150238")),
    );

    await POST(update(`/start ${payloadOf(bot.connectLink(planted)!)}`));

    const writes = fake.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0].params).toEqual(expect.arrayContaining([plantedSubject, "555"]));
    // Запис власника номера ніхто не чіпав
    expect(JSON.stringify(writes)).not.toContain("t733150238");

    chats.push({ id: "c5", subject: plantedSubject, chatId: "555", createdAt: new Date() });
    sent = [];

    // Сторонній бачить тільки заявку, яку сам створив
    await POST(update(bot.CHECK_BUTTON));
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("№2002");
    expect(sent[0].text).not.toContain("№1001");

    // Кнопкою чужу заявку теж не зачепити
    await POST(
      new Request("http://localhost/api/telegram/client", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": bot.webhookSecret()! },
        body: JSON.stringify({
          callback_query: { id: "q1", data: bot.receivedButton(victimLead), message: { message_id: 7, chat: { id: 555, type: "private" } } },
        }),
      }),
    );
    expect(fake.writes()).toHaveLength(1);

    // Статус справжнього ремонту йде лише власнику номера
    sent = [];
    expect(await bot.notifyClientStatus(victimLead as Lead)).toBe(true);
    expect(sent.map((s) => s.chat_id)).toEqual(["777"]);
  });

  it("статус не зібрався — клієнт отримує пояснення, а не порожнє повідомлення", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    let asked = 0;
    fake.onSelect(leads, () => {
      // Перший запит — «чиї це заявки», другий — сам звіт: падає лише він
      if (++asked > 1) throw new Error("db down");
      return [{ ...LEAD, createdAt: new Date() }];
    });

    await POST(update(bot.CHECK_BUTTON));

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("Не вдалося показати статус");
  });

  it("Start без посилання чи з підробленим нічого не закріплює", async () => {
    await POST(update("/start"));
    await POST(update("/start t501234567-00000000000000000000"));
    expect(fake.writes()).toHaveLength(0);
    expect(sent).toHaveLength(2);
  });

  it("«Перевірити статус» показує незакриті ремонти того, хто пише", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [
      { ...LEAD, orderNo: 1003, status: "in_progress", createdAt: new Date() },
      { ...LEAD, orderNo: 1002, status: "done", createdAt: new Date() },
    ]);

    await POST(update(bot.CHECK_BUTTON));

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("№1003 — У роботі");
    expect(sent[0].text).not.toContain("№1002");
    // Шукаємо лише заявки з телефону, за яким закріплений чат
    expect(fake.queries.some((q) => /from "leads"/.test(q.sql) && q.params.includes("733150238"))).toBe(true);
  });

  it("усе закрито — показує останню заявку", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [{ ...LEAD, orderNo: 1002, status: "done", createdAt: new Date() }]);

    await POST(update("/status"));
    expect(sent[0].text).toContain("№1002 — Завершено");
  });

  it("чат не підключений — чужих заявок не шукаємо, просимо поділитися номером", async () => {
    await POST(update(bot.CHECK_BUTTON));
    expect(fake.queries.some((q) => /from "leads"/.test(q.sql))).toBe(false);
    expect(sent[0].reply_markup.keyboard[0][0]).toEqual({ text: bot.SHARE_BUTTON, request_contact: true });
  });

  const contact = (phone: string, owner: number) =>
    new Request("http://localhost/api/telegram/client", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": bot.webhookSecret()! },
      body: JSON.stringify({
        message: { from: { id: 555 }, chat: { id: 555, type: "private" }, contact: { phone_number: phone, user_id: owner } },
      }),
    });

  it("власний номер із Telegram закріплює чат за телефоном і одразу показує статус", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [{ ...LEAD, orderNo: 1003, status: "in_progress", createdAt: new Date() }]);

    await POST(contact("380733150238", 555));

    const [insert] = fake.writes();
    expect(insert.sql).toMatch(/^insert into "telegram_chats"/);
    expect(insert.params).toEqual(expect.arrayContaining(["t733150238", "555"]));
    expect(sent[0].text).toContain("статуси підключено");
    expect(sent[0].text).toContain("№1003 — У роботі");
    expect(sent[0].reply_markup.keyboard[0][0]).toEqual({ text: bot.CHECK_BUTTON });
  });

  it("чужий контакт не закріплюється", async () => {
    await POST(contact("380501234567", 999));
    expect(fake.writes()).toHaveLength(0);
    expect(sent[0].reply_markup.keyboard[0][0].request_contact).toBe(true);
  });

  it("у групі бот мовчить", async () => {
    await POST(update(`/start ${payloadOf(bot.connectLink(LEAD)!)}`, "group"));
    expect(fake.writes()).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
});

describe("погодження ціни й чат через бота", () => {
  const PRICED = { ...LEAD, status: "in_progress", price: 2400, createdAt: new Date() } as unknown as Lead;

  const post = (body: object) =>
    POST(
      new Request("http://localhost/api/telegram/client", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": bot.webhookSecret()! },
        body: JSON.stringify(body),
      }),
    );

  const press = (data: string) =>
    post({ callback_query: { id: "q1", data, message: { message_id: 7, chat: { id: 555, type: "private" } } } });

  const inserted = (table: string) => fake.writes().filter((q) => q.sql.startsWith(`insert into "${table}"`));

  it("ціна йде клієнту з кнопками «Погоджуюсь» і «Передзвоніть мені»", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    expect(await bot.offerPrice(PRICED)).toBe(true);

    expect(sent[0].text).toContain("№1001");
    expect(sent[0].text).toMatch(/2\s400 ₴/);
    expect(sent[0].reply_markup.inline_keyboard[0].map((b) => b.callback_data)).toEqual([
      bot.priceButton("ok", PRICED, 2400),
      bot.priceButton("call", PRICED, 2400),
    ]);
  });

  it("«Погоджуюсь» — запис у хроніці, повідомлення майстру, кнопки зникають", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);

    await press(bot.priceButton("ok", PRICED, 2400));

    expect(inserted("lead_events")[0].params).toEqual(expect.arrayContaining(["Клієнт погодив ціну: 2400 ₴"]));
    expect(JSON.stringify(inserted("lead_messages")[0].params)).toContain("Погоджуюсь на ціну");
    expect(calls.some((c) => c.method === "editMessageReplyMarkup" && c.body.message_id === 7)).toBe(true);
    expect(sent[0].text).toContain("погоджено");
  });

  it("те саме «Погоджуюсь» удруге (Telegram повторив) — другого запису й повідомлення немає", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);
    fake.onSelect(leadEvents, () => [
      { id: "e1", leadId: PRICED.id, text: "Клієнт погодив ціну: 2400 ₴", status: null, byMaster: false, createdAt: new Date() },
    ]);

    await press(bot.priceButton("ok", PRICED, 2400));

    expect(inserted("lead_events")).toHaveLength(0);
    expect(inserted("lead_messages")).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(calls.some((c) => c.method === "answerCallbackQuery")).toBe(true);
  });

  it("раніше погоджували іншу ціну — нова погоджується як слід", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);
    fake.onSelect(leadEvents, () => [
      { id: "e1", leadId: PRICED.id, text: "Клієнт погодив ціну: 1900 ₴", status: null, byMaster: false, createdAt: new Date() },
    ]);

    await press(bot.priceButton("ok", PRICED, 2400));

    expect(inserted("lead_events")[0].params).toEqual(expect.arrayContaining(["Клієнт погодив ціну: 2400 ₴"]));
    expect(inserted("lead_messages")).toHaveLength(1);
  });

  it("«Передзвоніть мені» — майстер бачить прохання, у хроніку нічого не пишемо", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);

    await press(bot.priceButton("call", PRICED, 2400));

    expect(inserted("lead_events")).toHaveLength(0);
    expect(JSON.stringify(inserted("lead_messages")[0].params)).toContain("Прошу передзвонити");
  });

  it("кнопка зі старою ціною нічого не погоджує", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [{ ...PRICED, price: 3000 }]);

    await press(bot.priceButton("ok", PRICED, 2400));

    expect(inserted("lead_events")).toHaveLength(0);
    expect(inserted("lead_messages")).toHaveLength(0);
  });

  it("кнопка чужої заявки нічого не робить", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);

    await press(`ok:${"2".repeat(32)}:2400`);

    expect(fake.writes()).toHaveLength(0);
  });

  const SHIPPED = { ...LEAD, status: "shipped", ttn: "20450000000000", createdAt: new Date() } as unknown as Lead;

  it("про відправку бот пише з кнопкою «Я отримав посилку»", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    await bot.notifyClientStatus(SHIPPED);
    expect(sent[0].reply_markup.inline_keyboard[0][0]).toEqual({
      text: "Я отримав посилку",
      callback_data: bot.receivedButton(SHIPPED),
    });
  });

  it("«Я отримав посилку» закриває заявку, запускає гарантію і каже клієнту дату", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [SHIPPED]);

    await press(bot.receivedButton(SHIPPED));

    const update = fake.writes().find((q) => q.sql.startsWith('update "leads"'))!;
    expect(update.sql).toContain('"warranty_until"');
    expect(update.params).toContain("done");
    expect(JSON.stringify(inserted("lead_events")[0].params)).toContain("Клієнт підтвердив, що отримав посилку");
    expect(sent.at(-1)!.text).toContain("Гарантія діє до");
  });

  it("«Я отримав посилку» на вже закритій заявці нічого не міняє", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [{ ...SHIPPED, status: "done" }]);

    await press(bot.receivedButton(SHIPPED));
    expect(fake.writes()).toHaveLength(0);
  });

  it("текст від клієнта потрапляє в чат його незакритої заявки, клієнт отримує підтвердження", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);

    await post({ message: { text: "Коли буде готово?", from: { id: 555 }, chat: { id: 555, type: "private" } } });

    const [message] = inserted("lead_messages");
    expect(message.params).toEqual(expect.arrayContaining([PRICED.id, "client", "Коли буде готово?"]));
    expect(sent[0].text).toContain("Передали майстру");
  });

  it("відповідь майстра з адмінки йде клієнту в Telegram", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);

    expect(await bot.forwardMasterMessage(PRICED.id, "Завтра до обіду", null)).toBe(true);
    expect(sent[0].chat_id).toBe("555");
    expect(sent[0].text).toContain("Завтра до обіду");
  });

  it("фото від клієнта зберігається в чаті заявки разом із підписом", async () => {
    uploaded.length = 0;
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);
    vi.stubGlobal("fetch", async (url: string, init?: { body: string }) => {
      if (url.endsWith("/getFile")) return Response.json({ result: { file_path: "photos/a.jpg" } });
      if (url.includes("/file/bot")) return new Response(new Uint8Array([1, 2, 3, 4]));
      sent.push(JSON.parse(init!.body));
      return new Response("{}");
    });

    await post({
      message: {
        caption: "Ось тріщина",
        photo: [
          { file_id: "small", width: 90, height: 60 },
          { file_id: "big", width: 1280, height: 853 },
        ],
        from: { id: 555 },
        chat: { id: 555, type: "private" },
      },
    });

    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].path.startsWith(`chat/${PRICED.id}/`)).toBe(true);
    expect(uploaded[0].size).toBe(4);

    const [message] = inserted("lead_messages");
    expect(message.params).toEqual(expect.arrayContaining([PRICED.id, "client", "Ось тріщина", uploaded[0].path, 1280, 853]));
    expect(sent[0].text).toContain("Передали майстру");
  });

  it("фото не вдалося забрати з Telegram — у чат нічого не пишемо, клієнт про це знає", async () => {
    uploaded.length = 0;
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);
    vi.stubGlobal("fetch", async (url: string, init?: { body: string }) => {
      if (url.endsWith("/getFile")) return Response.json({ ok: false });
      sent.push(JSON.parse(init!.body));
      return new Response("{}");
    });

    await post({ message: { photo: [{ file_id: "big" }], from: { id: 555 }, chat: { id: 555, type: "private" } } });

    expect(uploaded).toHaveLength(0);
    expect(inserted("lead_messages")).toHaveLength(0);
    expect(sent[0].text).toContain("Не вдалося прийняти фото");
  });

  const PHOTO = new File([new Uint8Array([1, 2, 3])], "x.jpg", { type: "image/jpeg" });

  it("фото майстра йде клієнту самим фото, без окремого тексту", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);

    expect(await bot.forwardMasterMessage(PRICED.id, "", PHOTO)).toBe(true);

    const photo = calls.find((c) => c.method === "sendPhoto")!;
    expect(photo.body.chat_id).toBe("555");
    expect(photo.body.photo).toBeInstanceOf(File);
    expect(String(photo.body.caption)).toContain("№1001");
    expect(sent).toHaveLength(0);
  });

  it("Telegram не взяв фото — клієнт дізнається, що воно чекає в чаті на сайті", async () => {
    fake.onSelect(telegramChats, () => [CHAT]);
    fake.onSelect(leads, () => [PRICED]);
    vi.stubGlobal("fetch", async (url: string, init: { body: string | FormData }) => {
      if (url.endsWith("/sendPhoto")) return new Response("{}", { status: 400 });
      sent.push(JSON.parse(init.body as string));
      return new Response("{}", { status: 200 });
    });

    expect(await bot.forwardMasterMessage(PRICED.id, "Ось так виглядає", PHOTO)).toBe(true);
    expect(sent[0].text).toContain("Ось так виглядає");
    expect(sent[0].text).toContain("в чаті заявки на сайті");
  });
});
