import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Прийом заявки — єдиний шлях, яким клієнт до нас потрапляє. Заявка не має
 * губитись, сміття не має потрапляти в базу, а кривий запит не має валити
 * сервер у 500.
 */

const m = vi.hoisted(() => ({
  limit: { ok: true } as { ok: true } | { ok: false; retryAfter: number },
  userId: null as string | null,
  profileEmail: null as string | null,
  inserted: [] as Record<string, unknown>[],
  insertFails: false,
  notified: [] as string[],
  pushed: [] as { title: string; body: string; url: string }[],
  escalated: [] as string[],
  startFails: false,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async () => m.limit,
  clientIp: () => "1.2.3.4",
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: m.userId }),
  currentUser: async () =>
    m.profileEmail ? { primaryEmailAddress: { emailAddress: m.profileEmail } } : null,
}));

vi.mock("@/db", () => ({
  getDb: () => ({
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        returning: async () => {
          if (m.insertFails) throw new Error("db down");
          m.inserted.push(v);
          return [{ id: "lead-42", orderNo: 42 }];
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/telegram", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram")>()),
  notifyMaster: async (html: string) => {
    m.notified.push(html);
  },
}));

// Збережену заявку — push на телефони (з Telegram як запасом) і ескалація
vi.mock("@/lib/notify", () => ({
  alertMasters: async (push: { title: string; body: string; url: string }, html: string) => {
    m.pushed.push(push);
    m.notified.push(html);
    return "push";
  },
}));
vi.mock("@/workflows/escalate-lead", () => ({ escalateLead: () => {} }));
vi.mock("workflow/api", () => ({
  start: async (_fn: unknown, args: string[]) => {
    if (m.startFails) throw new Error("workflow down");
    m.escalated.push(args[0]);
  },
}));

import { POST } from "@/app/api/lead/route";

const post = (body: unknown) =>
  POST(
    new Request("http://test/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  m.limit = { ok: true };
  m.userId = null;
  m.profileEmail = null;
  m.inserted = [];
  m.insertFails = false;
  m.notified = [];
  m.pushed = [];
  m.escalated = [];
  m.startFails = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/lead: що приймаємо", () => {
  it("ім'я + телефон — заявка в базі й сповіщення з номером", async () => {
    const res = await post({ name: " Олег ", phone: "073 315 02 38", source: "model", model: "iPhone 13" });
    expect(res.status).toBe(200);
    // telegram: null — клієнтський бот у тестах не налаштований
    expect(await res.json()).toEqual({ ok: true, telegram: null });

    expect(m.inserted).toHaveLength(1);
    expect(m.inserted[0]).toMatchObject({
      name: "Олег",
      // Хай як набрали — у базі номер в одному вигляді
      phone: "+380733150238",
      email: null,
      model: "iPhone 13",
      source: "model",
      clerkUserId: null,
    });
    expect(m.notified[0]).toContain("Нова заявка №42");
    expect(m.pushed[0]).toEqual({
      title: "Нова заявка №42",
      body: "Олег · iPhone 13 · +380733150238",
      url: "/admin/zayavky?q=42&open=lead-42",
      tag: "lead-lead-42",
    });
    expect(m.escalated).toEqual(["lead-42"]);
  });

  it("ескалація не запустилась — заявка все одно прийнята", async () => {
    m.startFails = true;
    const res = await post({ name: "Олег", phone: "0733150238" });
    expect(res.status).toBe(200);
    expect(m.inserted).toHaveLength(1);
  });

  it("пошта з тіла запиту в базу не йде — анонім не підкине заявку в чужий кабінет", async () => {
    const res = await post({ name: "Олег", phone: "0733150238", email: "victim@example.com" });
    expect(res.status).toBe(200);
    expect(m.inserted[0]).toMatchObject({ email: null, clerkUserId: null });
    expect(m.notified[0]).not.toContain("victim@example.com");
  });

  it("залогінений: пошта завжди з профілю, а не з тіла запиту", async () => {
    m.userId = "user_1";
    m.profileEmail = "profile@example.com";
    await post({ name: "Олег", phone: "0733150238", email: "victim@example.com" });
    expect(m.inserted[0]).toMatchObject({ email: "profile@example.com", clerkUserId: "user_1" });
  });

  it("залогінений без телефону й пошти — пошта береться з профілю, заявка прив'язується", async () => {
    m.userId = "user_1";
    m.profileEmail = "profile@example.com";
    const res = await post({ name: "Олег" });
    expect(res.status).toBe(200);
    expect(m.inserted[0]).toMatchObject({ email: "profile@example.com", clerkUserId: "user_1" });
  });

  it("невідоме джерело замінюється на landing", async () => {
    await post({ name: "Олег", phone: "0733150238", source: "hack" });
    expect(m.inserted[0].source).toBe("landing");
  });

  it("порожні поля — NULL, задовгі — обрізаються", async () => {
    await post({ name: "Олег", phone: "0733150238", problem: "y".repeat(5000), model: "m".repeat(300), city: "   " });
    const row = m.inserted[0];
    expect((row.problem as string).length).toBe(500);
    expect((row.model as string).length).toBe(80);
    expect(row.city).toBeNull();
  });

  it("спецсимволи з тексту прибираються — розмітка не доходить ні до бази, ні до Telegram", async () => {
    await post({ name: "Олег", phone: "0733150238", problem: "<script>x</script> a & b {}", city: "Львів <b>№5</b>" });
    expect(m.inserted[0].problem).toBe("scriptx/script a & b");
    expect(m.inserted[0].city).toBe("Львів b№5/b");
    expect(m.notified[0]).toContain("a &amp; b");
    expect(m.notified[0]).not.toContain("<script>");
  });

  it("залогінений з поштою замість імені в профілі — заявка приймається як «Клієнт»", async () => {
    m.userId = "user_1";
    m.profileEmail = "profile@example.com";
    await post({ name: "profile@example.com", phone: "—" });
    expect(m.inserted[0]).toMatchObject({ name: "Клієнт", phone: null, email: "profile@example.com" });
  });
});

describe("POST /api/lead: що відхиляємо", () => {
  it("без імені — 422", async () => {
    const res = await post({ name: "  ", phone: "0733150238" });
    expect(res.status).toBe(422);
    expect(m.inserted).toHaveLength(0);
  });

  it("імʼя не з літер або задовге — 422", async () => {
    for (const name of ["<b>x</b>", "Олег123", "Я", "x".repeat(51), "!!!"]) {
      expect((await post({ name, phone: "0733150238" })).status).toBe(422);
    }
    expect(m.inserted).toHaveLength(0);
  });

  it("телефон не український — це не спосіб звʼязку", async () => {
    for (const phone of ["+48123456789", "0003150238", "073315023", "07331502389"]) {
      expect((await post({ name: "Олег", phone })).status).toBe(422);
    }
    expect(m.inserted).toHaveLength(0);
  });

  it("без жодного способу зв'язку — 422", async () => {
    expect((await post({ name: "Олег" })).status).toBe(422);
    expect((await post({ name: "Олег", phone: "123" })).status).toBe(422);
    expect((await post({ name: "Олег", email: "не-пошта" })).status).toBe(422);
    // Пошта без входу в кабінет — не спосіб звʼязку: її ніхто не підтвердив
    expect((await post({ name: "Олег", email: "oleg@example.com" })).status).toBe(422);
    expect(m.inserted).toHaveLength(0);
  });

  it("не JSON — 400", async () => {
    expect((await post("{не json")).status).toBe(400);
  });

  it("порожнє тіло (null) — 422, не 500", async () => {
    expect((await post("null")).status).toBe(422);
  });

  it("поля не того типу — 422, не 500", async () => {
    expect((await post({ name: 123, phone: "0733150238" })).status).toBe(422);
    expect((await post({ name: "Олег", phone: 733150238 })).status).toBe(422);
    expect(m.inserted).toHaveLength(0);
  });

  it("перевищено ліміт — 429 з Retry-After, до бази не доходить", async () => {
    m.limit = { ok: false, retryAfter: 120 };
    const res = await post({ name: "Олег", phone: "0733150238" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    expect(m.inserted).toHaveLength(0);
  });
});

describe("POST /api/lead: збій бази", () => {
  it("500, але майстер усе одно отримує заявку в Telegram", async () => {
    m.insertFails = true;
    const res = await post({ name: "Олег", phone: "0733150238" });
    expect(res.status).toBe(500);
    expect(m.notified).toHaveLength(1);
    expect(m.notified[0]).toContain("0733150238");
  });
});
