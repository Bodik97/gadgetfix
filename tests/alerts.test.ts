import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Сповіщення про збої: мають приходити на справжні помилки, мовчати на
 * redirect/notFound, не засипати чат однаковим і не нести персональних даних.
 */

const m = vi.hoisted(() => ({ sent: [] as string[] }));

vi.mock("@/lib/telegram", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram")>()),
  notifyDev: async (html: string) => {
    m.sent.push(html);
  },
}));

import { reportError, resetAlerts } from "@/lib/alerts";

const req = { path: "/admin/zayavky?q=0733150238", method: "GET" };
const ctx = { routePath: "/admin/zayavky", routeType: "render" };

beforeEach(() => {
  m.sent = [];
  resetAlerts();
});

describe("reportError", () => {
  it("справжня помилка — повідомлення з маршрутом і текстом, HTML екранований", async () => {
    await reportError(new Error('column "assignee" <does not> exist'), req, ctx);
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]).toContain("GET /admin/zayavky");
    expect(m.sent[0]).toContain("Маршрут: /admin/zayavky · render");
    expect(m.sent[0]).toContain("&lt;does not&gt;");
  });

  it("параметри запиту (телефон з пошуку) в повідомлення не потрапляють", async () => {
    await reportError(new Error("boom"), req, ctx);
    expect(m.sent[0]).not.toContain("0733150238");
  });

  it("redirect() і notFound() — не помилки, мовчимо", async () => {
    for (const digest of ["NEXT_REDIRECT;replace;/admin/vhid;307;", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK;404"]) {
      await reportError(Object.assign(new Error("x"), { digest }), req, ctx);
    }
    expect(m.sent).toEqual([]);
  });

  it("та сама помилка — раз на 10 хвилин; інша — одразу", async () => {
    const t = Date.UTC(2026, 9, 4, 10, 0);
    await reportError(new Error("boom"), req, ctx, t);
    await reportError(new Error("boom"), req, ctx, t + 5 * 60_000);
    await reportError(new Error("інша"), req, ctx, t + 5 * 60_000);
    await reportError(new Error("boom"), req, ctx, t + 11 * 60_000);
    expect(m.sent).toHaveLength(3);
  });

  it("той самий збій із різним чужим вводом у тексті — одне сповіщення, а не потік", async () => {
    const t = Date.UTC(2026, 9, 4, 10, 0);
    for (const id of ["abc", "zzz", "1' or '1'='1", "../../etc/passwd"]) {
      await reportError(new Error(`invalid input syntax for type uuid: "${id}"`), req, ctx, t);
    }
    await reportError(new Error('value "9999999999" is out of range for type integer'), req, ctx, t);
    await reportError(new Error('value "8888888888" is out of range for type integer'), req, ctx, t);
    // Дві різні помилки — два повідомлення, скільки б значень не перебрали
    expect(m.sent).toHaveLength(2);
    expect(m.sent[0]).toContain("abc");
  });

  it("не Error, а рядок — теж доходить", async () => {
    await reportError("щось зовсім дивне", req, ctx);
    expect(m.sent[0]).toContain("щось зовсім дивне");
  });
});
