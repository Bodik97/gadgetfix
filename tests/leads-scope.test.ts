import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";

/**
 * Робочий список і архів ділять заявки за статусом: закриті («Завершено»,
 * «Відмова») — лише в архіві. Пошук без області шукає скрізь.
 */

vi.mock("@/db", async () => {
  const { fake } = await import("./helpers/fakeDb");
  return { getDb: () => fake.db };
});

import { findLeads } from "@/db/leads";
import { leads } from "@/db/schema";

const where = () => fake.queries[0].sql.split(" where ")[1] ?? "";

beforeEach(() => {
  fake.reset();
  // Список порожній, але підрахунок має повернути рядок із кількістю
  fake.onSelect(leads, (q) => (q.sql.startsWith("select count") ? [{ found: 0 }] : []));
});

describe("findLeads: область", () => {
  it("робочий список — без закритих", async () => {
    await findLeads({ scope: "active", page: 1, perPage: 20 });
    expect(where()).toMatch(/"leads"\."status" not in \(\$1, \$2\)/);
    expect(fake.queries[0].params).toEqual(expect.arrayContaining(["done", "rejected"]));
  });

  it("архів — лише закриті", async () => {
    await findLeads({ scope: "archive", page: 1, perPage: 20 });
    expect(where()).toMatch(/"leads"\."status" in \(\$1, \$2\)/);
  });

  it("пошук скрізь — без умови на статус", async () => {
    await findLeads({ scope: "all", q: "Олег", page: 1, perPage: 20 });
    expect(where()).not.toMatch(/"status"/);
  });

  it("«чекають відправки» — без закритих, як і лічильник на головній", async () => {
    await findLeads({ scope: "all", shipping: true, page: 1, perPage: 20 });
    expect(where()).toMatch(/"leads"\."delivery_requested" = \$1 and "leads"\."ttn" is null and "leads"\."status" not in \(\$2, \$3\)/);
  });
});

describe("findLeads: пошук цифрами", () => {
  const search = async (q: string) => {
    fake.queries.length = 0;
    await findLeads({ q, page: 1, perPage: 20 });
    return { where: where(), params: fake.queries[0].params };
  };

  it("короткий номер — це номер замовлення", async () => {
    const r = await search("1054");
    expect(r.where).toMatch(/"leads"\."order_no" = \$\d+/);
    expect(r.params).toContain(1054);
  });

  it("телефон чи ТТН цифрами не влазить у номер замовлення — умови на order_no немає, запит не падає", async () => {
    for (const q of ["380733150238", "20450012345678", "2147483648"]) {
      expect((await search(q)).where).not.toMatch(/"order_no"/);
    }
    // Найбільше число, яке колонка ще вміщує
    expect((await search("2147483647")).where).toMatch(/"order_no"/);
  });

  it("телефон шукається за останніми девʼятьма цифрами — тим самим ключем, що рахує «N-е звернення»", async () => {
    for (const q of ["+380733150238", "073 315 02 38", "(073) 315-02-38", "0733150238"]) {
      const r = await search(q);
      expect(r.where).toMatch(/right\(regexp_replace\("leads"\."phone", '\\D', '', 'g'\), 9\) = \$\d+/);
      expect(r.params).toContain("733150238");
    }
  });

  it("імʼя чи короткий номер телефонним ключем не шукаються", async () => {
    expect((await search("Олег 073")).where).not.toMatch(/regexp_replace/);
    expect((await search("1054")).where).not.toMatch(/regexp_replace/);
  });
});
