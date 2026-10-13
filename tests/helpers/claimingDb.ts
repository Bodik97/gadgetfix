import type { PgTable } from "drizzle-orm/pg-core";
import { fake } from "./fakeDb";

/**
 * fakeDb на `update … returning` завжди відповідає порожньо — ніби жоден рядок
 * не підійшов під умову. Для коду, що закриває заявку умовним UPDATE і дивиться,
 * чи повернувся рядок, це означало б «уже закрито» в кожному тесті.
 *
 * Ця обгортка лишає все як є (запит так само потрапляє у fake.queries), але
 * на `returning` віддає `claims.rows`: за замовчуванням один рядок — «умова
 * спрацювала»; порожній масив — «хтось встиг раніше».
 */
export const claims = {
  rows: [{ id: "claimed" }] as Record<string, unknown>[],
  reset() {
    this.rows = [{ id: "claimed" }];
  },
};

type Returning = { returning: (...args: unknown[]) => PromiseLike<unknown> };

export const claimingDb = new Proxy(fake.db, {
  get(db, prop) {
    if (prop !== "update") return Reflect.get(db, prop);

    return (table: PgTable) => {
      const builder = db.update(table);
      return {
        set(values: Record<string, unknown>) {
          const query = builder.set(values as never) as unknown as Returning;
          const returning = query.returning.bind(query);

          // Справжній запит виконується, як і раніше, — підміняємо лише рядки у відповіді
          query.returning = (...args) => Promise.resolve(returning(...args)).then(() => claims.rows);
          return query;
        },
      };
    };
  },
});
