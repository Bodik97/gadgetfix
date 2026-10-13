import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { leads } from "@/db/schema";

/**
 * Цифри каси. Плитка «Оплачено» і журнал руху мають рахувати однаково:
 * завдаток — у день, коли його внесли, решта — у день повної оплати. Інакше
 * на роботі, де завдаток дали в одному місяці, а доплатили в наступному,
 * сума журналу за місяць не сходиться з плиткою.
 */

vi.mock("@/db", async () => {
  const { fake } = await import("./helpers/fakeDb");
  return { getDb: () => fake.db };
});

import { getCounters, getMoney, getOutstanding } from "@/db/adminStats";
import { getMoneyJournal } from "@/db/moneyJournal";

const OCT = new Date("2026-09-30T21:00:00Z");
const NOV = new Date("2026-10-31T22:00:00Z");
const DEC = new Date("2026-11-30T22:00:00Z");

/** Одна робота: 3000 ₴, завдаток 1000 ₴ у жовтні, решта й видача — у листопаді */
const JOB = {
  leadId: "l1",
  orderNo: 1001,
  client: "Олег",
  phone: "0733150238",
  model: "iPhone 13",
  service: "Екран",
  price: 3000,
  partsCost: 1200,
  prepayment: 1000,
  prepaidAt: new Date("2026-10-20T10:00:00Z"),
  paidAt: new Date("2026-11-05T10:00:00Z"),
};

const squash = (sql: string) => sql.replace(/\s+/g, " ");

beforeEach(() => fake.reset());

describe("getMoney — гроші за датою, коли вони зайшли", () => {
  it("виручка: решта в день оплати плюс завдатки, внесені в цей проміжок", async () => {
    fake.onSelect(leads, () => [{ revenue: 0, cost: 0, jobs: 0 }]);
    await getMoney(OCT, NOV);

    const { sql, params } = fake.queries[0];
    const text = squash(sql);
    const paid = `("paid_at" >= $N and "paid_at" < $N)`;
    const prepaid = `("prepaid_at" >= $N and "prepaid_at" < $N)`;
    const shape = text.replace(/\$\d+/g, "$N").replace(/"leads"\./g, "");

    // Повна ціна в день оплати — мінус завдаток, якщо він справді надходив раніше
    expect(shape).toContain(
      `sum(case when ${paid} then coalesce("price", 0) - case when "prepaid_at" is not null then coalesce("prepayment", 0) else 0 end end)`,
    );
    // Сам завдаток — у день, коли його внесли
    expect(shape).toContain(`sum(case when ${prepaid} then "prepayment" end)`);
    // Деталь і кількість робіт — лише за повністю оплаченими в цей проміжок
    expect(shape).toContain(`sum(case when ${paid} then "parts_cost" end)`);
    expect(shape).toContain(`count(*) filter (where ${paid})`);
    // У вибірку потрапляє і робота, де в цей проміжок був лише завдаток
    expect(shape).toContain(`where (${paid} or ${prepaid})`);

    expect(new Set(params)).toEqual(new Set([OCT.toISOString(), NOV.toISOString()]));
  });

  it("відкритий проміжок — без верхньої межі", async () => {
    fake.onSelect(leads, () => [{ revenue: 5000, cost: 1200, jobs: 2 }]);
    expect(await getMoney(NOV)).toEqual({ revenue: 5000, cost: 1200, jobs: 2, profit: 3800 });
    expect(fake.queries[0].sql).not.toMatch(/ < \$/);
  });
});

describe("журнал — та сама основа, що й у плитки", () => {
  const journal = async (from: Date, to: Date) => {
    fake.reset();
    // Перший запит журналу — оплати, другий — завдатки; кожен бачить роботу лише у своєму місяці
    fake.onSelect(leads, (q) => {
      const column = q.sql.includes('"leads"."paid_at" is not null') ? JOB.paidAt : JOB.prepaidAt;
      return column >= from && column < to ? [JOB] : [];
    });
    return (await getMoneyJournal(from, to)).map((e) => [e.kind, e.amount]);
  };

  it("завдаток у жовтні, решта в листопаді — разом рівно ціна, і жодна частина не рахується двічі", async () => {
    expect(await journal(OCT, NOV)).toEqual([["prepaid", 1000]]);
    expect(await journal(NOV, DEC)).toEqual([["paid", 2000]]);
  });
});

describe("getOutstanding — «Очікує оплати»", () => {
  it("віднімає лише завдатки, що справді надійшли: вписана сума без відмітки — ще не гроші", async () => {
    fake.onSelect(leads, () => [{ jobs: 2, billed: 5000, prepaid: 1000 }]);
    expect(await getOutstanding()).toEqual({ jobs: 2, billed: 5000, prepaid: 1000, due: 4000 });
    expect(squash(fake.queries[0].sql)).toMatch(
      /sum\(case when "(leads"\.")?prepaid_at" is not null then "(leads"\.")?prepayment" end\)/,
    );
  });
});

describe("getCounters — «чекають відправки»", () => {
  it("закриті заявки не рахуються: видане в руки не висить у лічильнику вічно", async () => {
    fake.onSelect(leads, () => [{ n: 0 }]);
    await getCounters();
    const ship = fake.queries.find((q) => q.sql.includes('"delivery_requested"'))!;
    expect(ship.sql).toMatch(/"leads"\."ttn" is null and "leads"\."status" not in \(\$\d+, \$\d+\)/);
    expect(ship.params).toEqual(expect.arrayContaining(["done", "rejected"]));
  });
});
