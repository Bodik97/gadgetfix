import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Чат клієнта з майстром і фото в ньому. Головне — права: чужу заявку не
 * читати, від імені майстра не писати, фото з іншої заявки за відомим id не
 * отримати.
 */

const m = vi.hoisted(() => ({
  limit: { ok: true } as { ok: true } | { ok: false; retryAfter: number },
  /** Хто має доступ: набір "lead:side" */
  access: new Set<string>(),
  added: [] as { lead: string; side: string; msg: Record<string, unknown> }[],
  marked: [] as string[],
  uploaded: [] as string[],
  notified: [] as string[],
  message: undefined as Record<string, unknown> | undefined,
  blob: null as unknown,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async () => m.limit,
  clientIp: () => "1.2.3.4",
}));

vi.mock("@/lib/chatAccess", () => ({
  canUseChat: async (lead: string, side: string) => m.access.has(`${lead}:${side}`),
}));

vi.mock("@/db/messages", () => ({
  MAX_MESSAGE: 1000,
  getMessages: async () => [
    { id: "m1", author: "master", text: "Готово", createdAt: new Date("2026-05-01T10:00:00Z"), imagePath: null },
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", author: "client", text: "", createdAt: new Date("2026-05-01T11:00:00Z"), imagePath: "chat/11111111-1111-1111-1111-111111111111/x", imageWidth: 800, imageHeight: 600 },
  ],
  markRead: async (lead: string, side: string) => {
    m.marked.push(`${lead}:${side}`);
  },
  addMessage: async (lead: string, side: string, msg: Record<string, unknown>) => {
    m.added.push({ lead, side, msg });
  },
  getMessage: async () => m.message,
}));

vi.mock("@/db/leads", () => ({
  getLeadBrief: async () => ({ orderNo: 7, name: "Олег" }),
}));

vi.mock("@vercel/blob", () => ({
  put: async (path: string) => {
    m.uploaded.push(path);
    return { pathname: path };
  },
  get: async () => m.blob,
}));

vi.mock("@/lib/telegram", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram")>()),
  notifyMaster: async (html: string) => {
    m.notified.push(html);
  },
}));

import { GET, POST } from "@/app/api/chat/[lead]/route";
import { GET as GET_IMAGE } from "@/app/api/chat/[lead]/image/[msg]/route";

const params = (lead: string) => ({ params: Promise.resolve({ lead }) });

const read = (lead: string, side?: string) =>
  GET(new Request(`http://test/api/chat/${lead}${side ? `?side=${side}` : ""}`), params(lead));

function send(lead: string, fields: Record<string, string | File>, side?: string) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return POST(
    new Request(`http://test/api/chat/${lead}${side ? `?side=${side}` : ""}`, { method: "POST", body: form }),
    params(lead),
  );
}

const image = (lead: string, msg: string) =>
  GET_IMAGE(new Request(`http://test/api/chat/${lead}/image/${msg}`), {
    params: Promise.resolve({ lead, msg }),
  });

const photo = (type = "image/jpeg", size = 10) => new File([new Uint8Array(size)], "p.jpg", { type });

beforeEach(() => {
  m.limit = { ok: true };
  m.access = new Set(["11111111-1111-1111-1111-111111111111:client"]);
  m.added = [];
  m.marked = [];
  m.uploaded = [];
  m.notified = [];
  m.message = undefined;
  m.blob = null;
});

describe("GET /api/chat/[lead]", () => {
  it("власник читає свій чат — повідомлення, фото через наш маршрут, позначка «прочитано»", async () => {
    const res = await read("11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("client");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].image).toEqual({ url: "/api/chat/11111111-1111-1111-1111-111111111111/image/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", width: 800, height: 600 });
    expect(m.marked).toEqual(["11111111-1111-1111-1111-111111111111:client"]);
  });

  it("чужий чат — 403, нічого не позначаємо прочитаним", async () => {
    expect((await read("22222222-2222-2222-2222-222222222222")).status).toBe(403);
    expect(m.marked).toEqual([]);
  });

  it("клієнт не може назватися майстром", async () => {
    expect((await read("11111111-1111-1111-1111-111111111111", "master")).status).toBe(403);
  });

  it("невідомий side вважається клієнтом", async () => {
    const res = await read("11111111-1111-1111-1111-111111111111", "admin");
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("client");
  });
});

describe("кривий id у адресі", () => {
  it("не UUID — 404, до перевірки прав і бази не доходимо", async () => {
    m.access.add("abc:client").add("abc:master").add("1' or '1'='1:client");
    expect((await read("abc")).status).toBe(404);
    expect((await read("abc", "master")).status).toBe(404);
    expect((await send("1' or '1'='1", { text: "hi" })).status).toBe(404);
    expect((await image("abc", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2")).status).toBe(404);
    m.access.add("11111111-1111-1111-1111-111111111111:client");
    expect((await image("11111111-1111-1111-1111-111111111111", "abc")).status).toBe(404);
    expect(m.marked).toEqual([]);
    expect(m.added).toEqual([]);
  });
});

describe("POST /api/chat/[lead]", () => {
  it("клієнт пише — повідомлення збережене, майстру сповіщення", async () => {
    const res = await send("11111111-1111-1111-1111-111111111111", { text: "  Коли буде готово?  " });
    expect(res.status).toBe(200);
    expect(m.added).toEqual([
      { lead: "11111111-1111-1111-1111-111111111111", side: "client", msg: { text: "Коли буде готово?", imagePath: null, imageWidth: null, imageHeight: null } },
    ]);
    expect(m.notified[0]).toContain("№7");
  });

  it("майстер пише — сповіщення назад собі не шлемо", async () => {
    m.access.add("11111111-1111-1111-1111-111111111111:master");
    await send("11111111-1111-1111-1111-111111111111", { text: "Готово" }, "master");
    expect(m.added[0].side).toBe("master");
    expect(m.notified).toEqual([]);
  });

  it("у чужий чат і від імені майстра без прав — 403", async () => {
    expect((await send("22222222-2222-2222-2222-222222222222", { text: "hi" })).status).toBe(403);
    expect((await send("11111111-1111-1111-1111-111111111111", { text: "hi" }, "master")).status).toBe(403);
    expect(m.added).toEqual([]);
  });

  it("порожнє або задовге повідомлення — 400", async () => {
    expect((await send("11111111-1111-1111-1111-111111111111", { text: "   " })).status).toBe(400);
    expect((await send("11111111-1111-1111-1111-111111111111", { text: "я".repeat(1001) })).status).toBe(400);
    expect(m.added).toEqual([]);
  });

  it("фото: завантажується у приватне сховище цієї заявки", async () => {
    const res = await send("11111111-1111-1111-1111-111111111111", { text: "", image: photo(), width: "800", height: "600" });
    expect(res.status).toBe(200);
    expect(m.uploaded[0]).toMatch(/^chat\/11111111-1111-1111-1111-111111111111\//);
    expect(m.added[0].msg).toMatchObject({ imageWidth: 800, imageHeight: 600 });
  });

  it("не фото або завелике фото — 400, у сховище не потрапляє", async () => {
    expect((await send("11111111-1111-1111-1111-111111111111", { image: photo("text/html") })).status).toBe(400);
    expect((await send("11111111-1111-1111-1111-111111111111", { image: photo("image/svg+xml") })).status).toBe(400);
    expect((await send("11111111-1111-1111-1111-111111111111", { image: photo("image/jpeg", 6 * 1024 * 1024 + 1) })).status).toBe(400);
    expect(m.uploaded).toEqual([]);
  });

  it("перевищено ліміт — 429", async () => {
    m.limit = { ok: false, retryAfter: 60 };
    expect((await send("11111111-1111-1111-1111-111111111111", { text: "hi" })).status).toBe(429);
  });
});

describe("GET /api/chat/[lead]/image/[msg]", () => {
  const okBlob = { statusCode: 200, stream: new ReadableStream(), blob: { contentType: "image/png" } };

  it("власник бачить фото зі своєї заявки, кеш лише приватний", async () => {
    m.message = { leadId: "11111111-1111-1111-1111-111111111111", imagePath: "chat/11111111-1111-1111-1111-111111111111/x" };
    m.blob = okBlob;
    const res = await image("11111111-1111-1111-1111-111111111111", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toMatch(/^private/);
  });

  it("без доступу до заявки — 403", async () => {
    m.message = { leadId: "22222222-2222-2222-2222-222222222222", imagePath: "chat/22222222-2222-2222-2222-222222222222/x" };
    m.blob = okBlob;
    expect((await image("22222222-2222-2222-2222-222222222222", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9")).status).toBe(403);
  });

  it("фото з іншої заявки через свою — 404", async () => {
    m.message = { leadId: "22222222-2222-2222-2222-222222222222", imagePath: "chat/22222222-2222-2222-2222-222222222222/x" };
    m.blob = okBlob;
    expect((await image("11111111-1111-1111-1111-111111111111", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9")).status).toBe(404);
  });

  it("файл зник зі сховища — 404, не 500", async () => {
    m.message = { leadId: "11111111-1111-1111-1111-111111111111", imagePath: "chat/11111111-1111-1111-1111-111111111111/x" };
    m.blob = null;
    expect((await image("11111111-1111-1111-1111-111111111111", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2")).status).toBe(404);
  });
});
