import { getTableColumns, type Table } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "@/db/schema";

/**
 * Справжній drizzle без справжньої бази: запити будуються так само, як у
 * продакшні, але замість Neon потрапляють сюди. Тест бачить SQL і параметри —
 * тобто саме те, що змінилося б у базі, а не лише факт виклику функції.
 */

export type Query = { sql: string; params: unknown[] };

/** Відповідь на SELECT: повертає рядки-обʼєкти або undefined (= порожньо) */
export type Responder = (q: Query) => Record<string, unknown>[] | undefined;

export function createFakeDb() {
  const queries: Query[] = [];
  let responders: { table: Table; match: RegExp; respond: Responder }[] = [];
  let inserts: { match: RegExp; respond: Responder }[] = [];

  const db = drizzle(
    async (sql, params, method) => {
      const q = { sql, params };
      queries.push(q);

      if (method !== "all") return { rows: [] };

      // insert … returning: поля в порядку ключів рядка, який дав тест
      for (const r of inserts) {
        if (!r.match.test(sql)) continue;
        return { rows: (r.respond(q) ?? []).map((row) => Object.values(row)) };
      }

      for (const r of responders) {
        if (!r.match.test(sql)) continue;
        const rows = r.respond(q) ?? [];
        // pg-proxy чекає рядки масивами в порядку вибраних полів. Вибрано всю
        // таблицю — це порядок її колонок; вибрано кілька полів (select({ path }))
        // — порядок ключів у рядку, який дав тест
        const cols = Object.keys(getTableColumns(r.table));
        const picked = sql.slice(0, sql.indexOf(" from ")).split(",").length;
        const value = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));
        return {
          rows: rows.map((row) =>
            picked === cols.length ? cols.map((c) => value(row[c])) : Object.values(row).map(value),
          ),
        };
      }
      return { rows: [] };
    },
    { schema },
  );

  return {
    db,
    queries,
    /** На SELECT із цієї таблиці віддавати такі рядки */
    onSelect(table: Table, respond: Responder) {
      const name = (table as unknown as Record<symbol, string>)[Symbol.for("drizzle:Name")];
      responders.push({ table, match: new RegExp(`^select .* from "${name}"`, "s"), respond });
    },
    /** Що повертає insert … returning у цю таблицю */
    onInsert(table: Table, respond: Responder) {
      const name = (table as unknown as Record<symbol, string>)[Symbol.for("drizzle:Name")];
      inserts.push({ match: new RegExp(`^insert into "${name}"`), respond });
    },
    /** Що повертає update … returning у цю таблицю */
    onUpdate(table: Table, respond: Responder) {
      const name = (table as unknown as Record<symbol, string>)[Symbol.for("drizzle:Name")];
      inserts.push({ match: new RegExp(`^update "${name}"`), respond });
    },
    /** Запити, що змінюють дані: insert / update / delete */
    writes() {
      return queries.filter((q) => /^(insert|update|delete)/i.test(q.sql));
    },
    reset() {
      queries.length = 0;
      responders = [];
      inserts = [];
    },
  };
}

/** Одна база на файл тестів — її ж віддає замокований getDb */
export const fake = createFakeDb();
