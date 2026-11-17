import { beforeEach, describe, expect, it, vi } from "vitest";

/** Ранковий підсумок: публічна адреса, тож без секрету Vercel Cron — нікого не пускаємо */

const m = vi.hoisted(() => ({ pushed: [] as { title: string; body: string }[] }));

vi.mock("@/db/today", () => ({
  getToday: async () => ({
    tiles: { late: 2, ready: 5, approval: 3, paused: 0 },
    rows: [{ kind: "take" }, { kind: "call" }],
  }),
}));
vi.mock("@/lib/push", () => ({
  sendPush: async (p: { title: string; body: string }) => {
    m.pushed.push(p);
    return 2;
  },
}));

import { GET } from "@/app/api/cron/ranok/route";

const req = (auth?: string) => new Request("http://test/api/cron/ranok", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  m.pushed = [];
  process.env.CRON_SECRET = "s3cret";
});

describe("GET /api/cron/ranok", () => {
  it("без секрету або з чужим — 401, push не йде", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(m.pushed).toEqual([]);
  });

  it("CRON_SECRET не задано — маршрут вимкнений навіть із «Bearer »", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer "))).status).toBe(401);
  });

  it("з секретом — один push із підсумком дня", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(m.pushed).toHaveLength(1);
    expect(m.pushed[0].body).toBe("прострочено 2 · видати 5 · чекають відповіді 3 · нових 1.");
  });
});
