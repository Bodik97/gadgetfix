import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  limit: { ok: true } as { ok: true } | { ok: false; retryAfter: number },
  limited: [] as { subject: string; limit: number; windowMs: number }[],
  inserted: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async (subject: string, limit: number, windowMs: number) => {
    m.limited.push({ subject, limit, windowMs });
    return m.limit;
  },
  clientIp: () => "1.2.3.4",
}));
vi.mock("@/lib/admin", () => ({ isAdmin: async () => false }));
vi.mock("@/db", () => ({
  getDb: () => ({
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        m.inserted.push(v);
      },
    }),
  }),
}));

import { deviceOf, isBot, parseEvent, refHost, visitorHash } from "@/lib/track";
import { POST } from "@/app/api/track/route";

describe("POST /api/track", () => {
  const post = (body: unknown) =>
    POST(
      new Request("http://gadgetfix.example/api/track", {
        method: "POST",
        headers: { host: "gadgetfix.example", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" },
        body: JSON.stringify(body),
      }),
    );

  beforeEach(() => {
    m.limit = { ok: true };
    m.limited = [];
    m.inserted = [];
  });

  it("подія записується, адреса рахується в межі 120 за хвилину", async () => {
    expect((await post({ kind: "click", path: "/", name: "hero-book" })).status).toBe(204);
    expect(m.inserted).toHaveLength(1);
    expect(m.limited).toEqual([{ subject: "track:ip:1.2.3.4", limit: 120, windowMs: 60_000 }]);
  });

  it("понад межу — тихо 204, у базу нічого не йде", async () => {
    m.limit = { ok: false, retryAfter: 30 };
    expect((await post({ kind: "view", path: "/" })).status).toBe(204);
    expect(m.inserted).toHaveLength(0);
  });

  it("клік на невідому кнопку не записується й місця в межі не займає", async () => {
    expect((await post({ kind: "click", path: "/", name: "=cmd|calc" })).status).toBe(204);
    expect(m.inserted).toHaveLength(0);
    expect(m.limited).toHaveLength(0);
  });
});

describe("parseEvent", () => {
  it("перегляд: бере шлях, чужий реферер і utm", () => {
    expect(parseEvent({ kind: "view", path: "/poslugy", ref: "https://www.google.com/search?q=x", utm: "insta" }, "gadgetfix.example")).toEqual({
      kind: "view",
      path: "/poslugy",
      name: null,
      referrer: "google.com",
      utm: "insta",
    });
  });

  it("клік без назви кнопки не приймається", () => {
    expect(parseEvent({ kind: "click", path: "/" }, "h")).toBeNull();
    expect(parseEvent({ kind: "click", path: "/", name: "hero-book" }, "h")?.name).toBe("hero-book");
  });

  it("адмінка, чужий вид події і шлях без слеша відкидаються", () => {
    expect(parseEvent({ kind: "view", path: "/admin/groshi" }, "h")).toBeNull();
    expect(parseEvent({ kind: "purchase", path: "/" }, "h")).toBeNull();
    expect(parseEvent({ kind: "view", path: "https://evil.example" }, "h")).toBeNull();
    expect(parseEvent(null, "h")).toBeNull();
  });

  it("клік приймається лише з назвою кнопки, яка є на сайті", () => {
    for (const name of ["=HYPERLINK(\"http://evil.example\")", "<script>", "hero-book-2", "toString", "constructor"]) {
      expect(parseEvent({ kind: "click", path: "/", name }, "h"), name).toBeNull();
    }
    expect(parseEvent({ kind: "click", path: "/", name: " footer-viber " }, "h")?.name).toBe("footer-viber");
  });

  it("обрізає задовгі значення", () => {
    const e = parseEvent({ kind: "view", path: "/" + "a".repeat(500), utm: "u".repeat(500) }, "h");
    expect(e?.path).toHaveLength(200);
    expect(e?.utm).toHaveLength(60);
    expect(parseEvent({ kind: "click", path: "/", name: "n".repeat(500) }, "h")).toBeNull();
  });
});

describe("refHost", () => {
  it("свій сайт і сміття — не джерело", () => {
    expect(refHost("https://www.gadgetfix.example/modeli", "gadgetfix.example")).toBeNull();
    expect(refHost("не адреса", "h")).toBeNull();
    expect(refHost(undefined, "h")).toBeNull();
  });
});

describe("visitorHash", () => {
  it("той самий відвідувач того ж дня — той самий хеш, наступного дня — інший", () => {
    const a = visitorHash("1.2.3.4", "UA", "2026-10-09", "salt");
    expect(visitorHash("1.2.3.4", "UA", "2026-10-09", "salt")).toBe(a);
    expect(visitorHash("1.2.3.4", "UA", "2026-10-10", "salt")).not.toBe(a);
    expect(a).not.toContain("1.2.3.4");
  });
});

describe("isBot і deviceOf", () => {
  it("боти й порожній user-agent не рахуються", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe(false);
  });

  it("телефон відрізняється від комп'ютера", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
  });
});
