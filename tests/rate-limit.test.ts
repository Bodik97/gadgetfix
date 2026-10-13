import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/pg-proxy";

/**
 * Обмежувач частоти. Головне тут — прибирання старих рядків: воно не має
 * зачіпати лічильники інших обмежувачів, у яких вікно довше.
 */

type Hit = { subject: string; at: Date };

const m = vi.hoisted(() => ({
  hits: [] as { subject: string; at: Date }[],
  deletes: [] as { sql: string; params: unknown[] }[],
}));

/** Умова прибирання: свої рядки поза вікном або чиї завгодно, але зовсім давні */
const CLEANUP = /^delete from "rate_hits" where \(\("rate_hits"\."subject" = \$1 and "rate_hits"\."at" < \$2\) or "rate_hits"\."at" < \$3\)$/;

vi.mock("@/db", () => ({
  getDb: () => {
    const db = drizzle(async (raw, params) => {
      const sql = raw.trim();
      // Вставка з перевіркою межі: у цих тестах місце завжди є
      if (sql.startsWith("insert into")) {
        m.hits.push({ subject: String(params[0]), at: new Date() });
        return { rows: [["id-1"]] };
      }
      if (sql.startsWith("delete from")) {
        m.deletes.push({ sql, params });
        // Виконуємо умову так, як її виконала б база, — лише якщо вона саме така
        if (CLEANUP.test(sql)) {
          const [subject, since, stale] = [String(params[0]), new Date(String(params[1])), new Date(String(params[2]))];
          m.hits = m.hits.filter((h) => !((h.subject === subject && h.at < since) || h.at < stale));
        } else if (/^delete from "rate_hits" where "rate_hits"\."subject" = \$1$/.test(sql)) {
          m.hits = m.hits.filter((h) => h.subject !== params[0]);
        } else {
          // Невідома умова — вважаємо найгірше: зникло все
          m.hits = [];
        }
      }
      return { rows: [] };
    });
    // Драйвер Neon віддає з execute обʼєкт із rows, а pg-proxy — самі рядки
    return Object.assign(Object.create(db), {
      execute: async (q: Parameters<typeof db.execute>[0]) => ({ rows: await db.execute(q) }),
    });
  },
}));

import { rateLimit, release } from "@/lib/rateLimit";

const ago = (ms: number) => new Date(Date.now() - ms);
const of = (subject: string): Hit[] => m.hits.filter((h) => h.subject === subject);

beforeEach(() => {
  m.hits = [];
  m.deletes = [];
});

describe("rateLimit: прибирання старих рядків", () => {
  it("звернення з коротким вікном не стирає лічильники з довшим вікном", async () => {
    m.hits = [
      // Невдалі входи в адмінку й перевірки замовлення: їхнє вікно 10–15 хвилин
      { subject: "login:ip:6.6.6.6", at: ago(5 * 60_000) },
      { subject: "login:ip:6.6.6.6", at: ago(9 * 60_000) },
      { subject: "order:ip:6.6.6.6", at: ago(3 * 60_000) },
      { subject: "order:no:105", at: ago(50 * 60_000) },
      // Своє за межами хвилинного вікна
      { subject: "chat:ip:1.2.3.4", at: ago(2 * 60_000) },
    ];

    expect(await rateLimit("chat:ip:1.2.3.4", 30, 60_000)).toEqual({ ok: true });

    expect(m.deletes).toHaveLength(1);
    expect(m.deletes[0].sql).toMatch(CLEANUP);
    expect(m.deletes[0].params[0]).toBe("chat:ip:1.2.3.4");

    expect(of("login:ip:6.6.6.6")).toHaveLength(2);
    expect(of("order:ip:6.6.6.6")).toHaveLength(1);
    expect(of("order:no:105")).toHaveLength(1);
    // Своє старе прибрано, лишився щойно зроблений запис
    expect(of("chat:ip:1.2.3.4")).toHaveLength(1);
  });

  it("зовсім давні рядки прибираються в будь-кого — таблиця не росте", async () => {
    m.hits = [
      { subject: "track:ip:9.9.9.9", at: ago(25 * 60 * 60_000) },
      { subject: "track:ip:8.8.8.8", at: ago(23 * 60 * 60_000) },
    ];

    await rateLimit("chat:ip:1.2.3.4", 30, 60_000);

    expect(of("track:ip:9.9.9.9")).toHaveLength(0);
    expect(of("track:ip:8.8.8.8")).toHaveLength(1);
  });

  it("release звільняє лише свого субʼєкта", async () => {
    m.hits = [
      { subject: "order:no:105", at: ago(1000) },
      { subject: "order:no:106", at: ago(1000) },
    ];
    await release("order:no:105");
    expect(of("order:no:105")).toHaveLength(0);
    expect(of("order:no:106")).toHaveLength(1);
  });
});
