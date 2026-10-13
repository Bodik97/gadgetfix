import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { leads, pushSubscriptions } from "@/db/schema";

/**
 * Push на телефони майстрів і нагадування про нічиї заявки. Головне — щоб
 * сповіщення не губилось: немає підписок → Telegram; телефон відписався →
 * запис прибирається; заявку взяли → нагадування припиняються.
 */

const m = vi.hoisted(() => ({
  sent: [] as { endpoint: string; body: string }[],
  failWith: {} as Record<string, number>,
  telegram: [] as string[],
}));

vi.mock("@/db", async () => {
  const { fake } = await import("./helpers/fakeDb");
  return { getDb: () => fake.db };
});

// Список майстрів береться з @/lib/admin, а той при завантаженні тягне cookies
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, set: () => {} }) }));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (sub: { endpoint: string }, body: string) => {
      const code = m.failWith[sub.endpoint];
      if (code) throw Object.assign(new Error("push failed"), { statusCode: code });
      m.sent.push({ endpoint: sub.endpoint, body });
    },
  },
}));

vi.mock("@/lib/telegram", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram")>()),
  notifyMaster: async (html: string) => {
    m.telegram.push(html);
  },
}));

import { sendPush } from "@/lib/push";
import { alertMasters } from "@/lib/notify";
import { remindByPush, stillWaiting } from "@/workflows/escalate-lead";

const sub = (id: string, endpoint: string, adminEmail = "b@gadgetfix.ua") => ({
  id,
  adminEmail,
  endpoint,
  p256dh: "k",
  auth: "a",
  userAgent: null,
  createdAt: new Date(),
});

const PAYLOAD = { title: "Нова заявка №1", body: "Олег", url: "/admin" };

beforeEach(() => {
  fake.reset();
  m.sent = [];
  m.failWith = {};
  m.telegram = [];
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("ADMIN_EMAIL", "b@gadgetfix.ua");
  vi.stubEnv("ADMIN_PASSWORD", "parol-pershoho");
  vi.stubEnv("ADMIN_EMAIL_2", "");
  vi.stubEnv("ADMIN_PASSWORD_2", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendPush", () => {
  it("на кожен телефон, повертає скільки прийняли", async () => {
    fake.onSelect(pushSubscriptions, () => [sub("s1", "https://push/1"), sub("s2", "https://push/2")]);
    expect(await sendPush(PAYLOAD)).toBe(2);
    expect(JSON.parse(m.sent[0].body)).toEqual(PAYLOAD);
  });

  it("телефон відписався (410) — запис видаляється, решта доходить", async () => {
    fake.onSelect(pushSubscriptions, () => [sub("s1", "https://push/1"), sub("s2", "https://push/2")]);
    m.failWith["https://push/1"] = 410;
    expect(await sendPush(PAYLOAD)).toBe(1);
    const del = fake.writes().find((q) => q.sql.startsWith('delete from "push_subscriptions"'));
    expect(del?.params).toEqual(["s1"]);
  });

  it("тимчасовий збій (500) — запис не чіпаємо", async () => {
    fake.onSelect(pushSubscriptions, () => [sub("s1", "https://push/1")]);
    m.failWith["https://push/1"] = 500;
    expect(await sendPush(PAYLOAD)).toBe(0);
    expect(fake.writes()).toEqual([]);
  });

  it("без ключів VAPID — нічого не шлемо й у базу не йдемо", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(await sendPush(PAYLOAD)).toBe(0);
    expect(fake.queries).toEqual([]);
  });
});

describe("alertMasters", () => {
  it("push дійшов — Telegram мовчить", async () => {
    fake.onSelect(pushSubscriptions, () => [sub("s1", "https://push/1")]);
    expect(await alertMasters(PAYLOAD, "<b>tg</b>")).toBe("push");
    expect(m.telegram).toEqual([]);
  });

  it("жоден телефон не підписаний — Telegram, щоб заявка не загубилась", async () => {
    expect(await alertMasters(PAYLOAD, "<b>tg</b>")).toBe("telegram");
    expect(m.telegram).toEqual(["<b>tg</b>"]);
  });

  describe("майстрів двоє", () => {
    const SECOND = "d@gadgetfix.ua";
    // Підписки кожного майстра вибираються окремим запитом — за його поштою
    const subsOf = (byEmail: Record<string, ReturnType<typeof sub>[]>) =>
      fake.onSelect(pushSubscriptions, (q) => byEmail[String(q.params[0])] ?? []);

    beforeEach(() => {
      vi.stubEnv("ADMIN_EMAIL_2", SECOND);
      vi.stubEnv("ADMIN_PASSWORD_2", "parol-druhoho");
    });

    it("push є лише в одного — другий не лишається без сповіщення: Telegram теж іде", async () => {
      subsOf({ "b@gadgetfix.ua": [sub("s1", "https://push/1")] });
      expect(await alertMasters(PAYLOAD, "<b>tg</b>")).toBe("telegram");
      expect(m.sent.map((s) => s.endpoint)).toEqual(["https://push/1"]);
      expect(m.telegram).toEqual(["<b>tg</b>"]);
    });

    it("push дійшов обом — Telegram мовчить", async () => {
      subsOf({ "b@gadgetfix.ua": [sub("s1", "https://push/1")], [SECOND]: [sub("s2", "https://push/2", SECOND)] });
      expect(await alertMasters(PAYLOAD, "<b>tg</b>")).toBe("push");
      expect(m.sent).toHaveLength(2);
      expect(m.telegram).toEqual([]);
    });

    it("в одного з майстрів push не доставився (збій) — Telegram", async () => {
      subsOf({ "b@gadgetfix.ua": [sub("s1", "https://push/1")], [SECOND]: [sub("s2", "https://push/2", SECOND)] });
      m.failWith["https://push/2"] = 500;
      expect(await alertMasters(PAYLOAD, "<b>tg</b>")).toBe("telegram");
      expect(m.telegram).toEqual(["<b>tg</b>"]);
    });
  });
});

describe("ескалація: stillWaiting і нагадування", () => {
  const LEAD = { id: "l1", orderNo: 1054, name: "Олег", model: "iPhone 13", service: null, phone: "0733150238", status: "new", assignee: null };

  it("нова й нічия — досі чекає", async () => {
    fake.onSelect(leads, () => [LEAD]);
    expect(await stillWaiting("l1")).toEqual({ id: "l1", orderNo: 1054, name: "Олег", what: "iPhone 13", phone: "0733150238" });
  });

  it("хтось узяв або статус змінився — нагадувань більше немає", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, assignee: "b@gadgetfix.ua" }]);
    expect(await stillWaiting("l1")).toBeNull();
    fake.reset();
    fake.onSelect(leads, () => [{ ...LEAD, status: "in_progress" }]);
    expect(await stillWaiting("l1")).toBeNull();
    fake.reset();
    expect(await stillWaiting("видалена")).toBeNull();
  });

  it("нагадування веде на заявку й замінює попереднє сповіщення про неї", async () => {
    fake.onSelect(pushSubscriptions, () => [sub("s1", "https://push/1")]);
    await remindByPush({ id: "l1", orderNo: 1054, name: "Олег", what: "iPhone 13", phone: null }, 5);
    expect(JSON.parse(m.sent[0].body)).toEqual({
      title: "Заявка №1054 чекає 5 хв",
      body: "Олег · iPhone 13 — ніхто ще не взяв",
      url: "/admin/zayavky?q=1054&open=l1",
      tag: "lead-l1",
    });
  });
});
