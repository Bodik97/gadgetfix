import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Маршрути, що віддають дані поза сторінками: фото відгуку (публічне, але лише
 * опубліковане), вивантаження каси й квитанція (лише майстру), відбиток стану.
 */

const m = vi.hoisted(() => ({
  admin: false,
  user: null as { id: string; primaryEmailAddress: { emailAddress: string } } | null,
  review: undefined as Record<string, unknown> | undefined,
  blob: null as unknown,
  lead: undefined as Record<string, unknown> | undefined,
  dbTouched: 0,
}));

vi.mock("@/lib/admin", () => ({ isAdmin: async () => m.admin }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: async () => m.user }));
vi.mock("@vercel/blob", () => ({ get: async () => m.blob }));

/** Будь-який ланцюжок drizzle завершується масивом з одним рядком */
function chain(): unknown {
  return new Proxy(() => {}, {
    get: (_t, key) => {
      if (key === "then") {
        m.dbTouched++;
        const row = m.review ?? { leads: 3, updated: new Date(1000), unread: 2, pending: 1 };
        return (resolve: (v: unknown) => void) => resolve([row]);
      }
      return chain();
    },
    apply: () => chain(),
  });
}
vi.mock("@/db", () => ({ getDb: () => chain() }));

vi.mock("@/db/adminStats", () => ({
  getPaidLeads: async () => [
    { orderNo: 1, paidAt: new Date("2026-05-02"), name: 'Олег "Ремонт"; ТОВ', phone: "0733150238", model: "iPhone", service: "Екран", price: 3000, partsCost: 1200, prepayment: 500 },
    // Передоплату призначили, але не внесли; у полях — те, що Excel узяв би за формулу
    { orderNo: 2, paidAt: new Date("2026-05-02T22:30:00Z"), name: "=HYPERLINK(\"http://evil.example\")", phone: "+380501234567", model: "@SUM(A1)", service: "-2+3", price: 1000, partsCost: 1500, prepayment: 700 },
  ],
}));
vi.mock("@/db/siteStats", () => ({
  getSiteStats: async () => ({
    views: 10,
    visitors: 4,
    pages: [{ path: "/=1+1", views: 3, visitors: 2 }],
    clicks: [{ name: "hero-book", clicks: 2, visitors: 2 }],
    sources: [{ source: "@evil", visitors: 1 }, { source: "-cmd|calc", visitors: 1 }],
    devices: [{ device: "mobile", visitors: 4 }],
    funnel: { visitors: 4, intent: 2, leads: 1, repairs: 1 },
  }),
}));
vi.mock("@/db/expenses", () => ({
  getExpenses: async () => [],
  categoryLabel: (c: string) => c,
}));
vi.mock("@/db/events", () => ({ getLeadById: async () => m.lead }));

import { GET as reviewImage } from "@/app/api/reviews/[id]/image/route";
import { GET as csv } from "@/app/admin/groshi/csv/route";
import { GET as statsCsv } from "@/app/admin/statystyka/csv/route";
import { GET as receipt } from "@/app/admin/zayavky/[id]/kvytantsiya/route";
import { GET as state } from "@/app/api/state/route";
import { GET as testAlert } from "@/app/admin/test-zboyu/route";
import { GET as testTelegram } from "@/app/admin/test-telegram/route";

const okBlob = { statusCode: 200, stream: new ReadableStream(), blob: { contentType: "image/webp" } };

beforeEach(() => {
  m.admin = false;
  m.user = null;
  m.review = undefined;
  m.blob = null;
  m.lead = undefined;
  m.dbTouched = 0;
});

describe("GET /api/reviews/[id]/image", () => {
  const ID = "33333333-3333-3333-3333-333333333333";
  const get = (id = ID) => reviewImage(new Request("http://test"), { params: Promise.resolve({ id }) });

  it("кривий id — 404, до бази не йдемо", async () => {
    m.review = { published: true, imagePath: "reviews/r1" };
    m.blob = okBlob;
    for (const id of ["r1", "1' or '1'='1", ID + "0"]) expect((await get(id)).status, id).toBe(404);
    expect(m.dbTouched).toBe(0);
  });

  it("опублікований відгук із фото — віддає фото", async () => {
    m.review = { published: true, imagePath: "reviews/r1" };
    m.blob = okBlob;
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
  });

  it("чернетка — 404, навіть якщо фото є", async () => {
    m.review = { published: false, imagePath: "reviews/r1" };
    m.blob = okBlob;
    expect((await get()).status).toBe(404);
  });

  it("відгук без фото або файл зник — 404", async () => {
    m.review = { published: true, imagePath: null };
    expect((await get()).status).toBe(404);
    m.review = { published: true, imagePath: "reviews/r1" };
    m.blob = null;
    expect((await get()).status).toBe(404);
  });
});

describe("GET /admin/groshi/csv", () => {
  it("не майстру — 403, до бази не йдемо", async () => {
    const res = await csv(new Request("http://test/admin/groshi/csv"));
    expect(res.status).toBe(403);
  });

  it("майстру — CSV з BOM, «;» і лапки екрановані, не кешується", async () => {
    m.admin = true;
    const res = await csv(new Request("http://test/admin/groshi/csv?period=month"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("cache-control")).toBe("no-store");

    // text() знімає BOM при декодуванні, тож дивимось сирі байти
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('"Олег ""Ремонт""; ТОВ"');
    expect(text).toContain('"1800"'); // 3000 - 1200
  });

  it("текст, схожий на формулу, отримує апостроф; телефон лишається текстом, числа — числами", async () => {
    m.admin = true;
    // Позначка «передоплату внесено» є лише в замовлення №1
    m.review = { orderNo: 1 };
    const text = new TextDecoder().decode(await (await csv(new Request("http://test/admin/groshi/csv?period=month"))).arrayBuffer());
    const [, first, second] = text.split("\r\n");

    expect(second).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
    expect(second).toContain(`"'+380501234567"`);
    expect(second).toContain(`"'@SUM(A1)"`);
    expect(second).toContain(`"'-2+3"`);
    // Відʼємне «чистими» — число, а не текст з апострофом
    expect(second.endsWith(';"-500"')).toBe(true);

    // Передоплата — лише внесена: 500 у першому рядку, 0 у другому
    expect(first.split(";").at(-2)).toBe('"500"');
    expect(second.split(";").at(-2)).toBe('"0"');

    // 22:30 UTC 2 травня — у Києві вже 3 травня
    expect(second.split(";")[1]).toBe('"03.05.26"');
  });
});

describe("GET /admin/statystyka/csv", () => {
  it("не майстру — 403", async () => {
    expect((await statsCsv(new Request("http://test/admin/statystyka/csv"))).status).toBe(403);
  });

  it("джерело чи utm, схожі на формулу, отримують апостроф; числа лишаються числами", async () => {
    m.admin = true;
    const text = await (await statsCsv(new Request("http://test/admin/statystyka/csv?period=month"))).text();
    expect(text).toContain(`"'@evil";"1"`);
    expect(text).toContain(`"'-cmd|calc";"1"`);
    expect(text).toContain(`"/=1+1";"3";"2"`);
    expect(text).toContain(`"Відвідувачів";"4"`);
  });
});

describe("GET /admin/zayavky/[id]/kvytantsiya", () => {
  const get = () => receipt(new Request("http://test"), { params: Promise.resolve({ id: "l1" }) });
  const LEAD = {
    orderNo: 12,
    name: '<script>alert(1)</script>',
    phone: "0733150238",
    model: "iPhone",
    service: null,
    problem: 'Не вмикається "зовсім"',
    createdAt: new Date("2026-05-01T10:00:00Z"),
    price: null,
    prepayment: 400,
  };

  it("не майстру — 403", async () => {
    m.lead = LEAD;
    expect((await get()).status).toBe(403);
  });

  it("неіснуюча заявка — 404", async () => {
    m.admin = true;
    expect((await get()).status).toBe(404);
  });

  it("квитанція: дві копії, дані клієнта екрановані", async () => {
    m.admin = true;
    m.lead = LEAD;
    const res = await get();
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("примірник клієнта");
    expect(html).toContain("примірник сервісу");
    expect(html).toContain("після діагностики");
  });
});

describe("GET /api/state", () => {
  it("анонім — version: null, до бази не йдемо", async () => {
    const res = await state();
    expect(await res.json()).toEqual({ version: null });
    expect(m.dbTouched).toBe(0);
  });

  it("майстер — відбиток із кількості, часу, непрочитаних і відгуків на модерації", async () => {
    m.admin = true;
    expect(await (await state()).json()).toEqual({ version: "3:1000:2:1" });
  });

  it("клієнт — свій відбиток", async () => {
    m.user = { id: "u1", primaryEmailAddress: { emailAddress: "a@b.cc" } };
    expect(await (await state()).json()).toEqual({ version: "3:1000:2", unread: 2 });
  });
});

describe("GET /admin/test-zboyu", () => {
  it("не майстру — 403, без помилки", async () => {
    expect((await testAlert()).status).toBe(403);
  });

  it("майстру — кидає помилку, щоразу з новим текстом", async () => {
    m.admin = true;
    const first = await testAlert().catch((e: Error) => e.message);
    await new Promise((r) => setTimeout(r, 2));
    const second = await testAlert().catch((e: Error) => e.message);

    expect(first).toMatch(/^Тестовий збій/);
    expect(second).not.toBe(first);
  });
});

describe("GET /admin/test-telegram", () => {
  it("не майстру — 403, до Telegram не йдемо", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await testTelegram()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("майстру — стан змінних, імʼя бота й відмова Telegram дослівно, без токена", async () => {
    m.admin = true;
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:secret");
    vi.stubEnv("TELEGRAM_CHAT_ID", "111");
    vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", " -5 ");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        json: async () =>
          url.endsWith("/getMe")
            ? { ok: true, result: { username: "some_bot" } }
            : url.endsWith("/getChat")
              ? { ok: true, result: {} }
              : { ok: false, description: "Bad Request: chat not found" },
      })),
    );

    const text = await (await testTelegram()).text();

    expect(text).toContain("TELEGRAM_BOT_TOKEN: задано");
    expect(text).toContain('TELEGRAM_ALERT_CHAT_ID (збої): " -5 "');
    expect(text).toContain("Бот за токеном: @some_bot");
    expect(text).toContain("Бачить чат майстра 111: так");
    expect(text).toContain("Тестове повідомлення в чат збоїв: НІ — Bad Request: chat not found");
    expect(text).not.toContain("secret");

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
