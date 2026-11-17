import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { leads, partnerSettlements } from "@/db/schema";

/**
 * Розрахунок із магазином «Онлайн» — це гроші: закриває лише власник,
 * один раз на місяць, і утримання не може перевищити суму.
 */

const m = vi.hoisted(() => ({ admin: true as boolean, owner: true as boolean }));

vi.mock("@/db", () => ({ getDb: () => fake.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/admin", () => ({
  currentAdmin: async () => (m.admin ? { name: "Богдан", email: "b@x.ua", role: m.owner ? "owner" : "master" } : null),
  isOwner: async () => m.admin && m.owner,
}));

import { addPrice, markPaid } from "@/app/admin/onlain/actions";
import { monthKey, monthStartKyiv } from "@/db/online";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

const issued = (id: string, price: number) => ({
  id,
  orderNo: 1100,
  onlineNo: 5,
  channel: "online",
  stage: "issued",
  status: "done",
  price,
  issuedAt: new Date("2026-11-10T10:00:00Z"),
  problems: [],
  condition: [],
  kit: [],
  name: "Магазин",
  source: "manual",
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-10T10:00:00Z"),
});

beforeEach(() => {
  fake.reset();
  m.admin = true;
  m.owner = true;
});

describe("місяць за Києвом", () => {
  it("листопад починається о 22:00 UTC 31 жовтня (зима, UTC+2)", () => {
    expect(monthStartKyiv("2026-11").toISOString()).toBe("2026-10-31T22:00:00.000Z");
  });

  it("липень — о 21:00 UTC 30 червня (літо, UTC+3)", () => {
    expect(monthStartKyiv("2026-07").toISOString()).toBe("2026-06-30T21:00:00.000Z");
  });

  it("пізній вечір 30 листопада за Києвом — ще листопад", () => {
    expect(monthKey(new Date("2026-11-30T21:30:00Z"))).toBe("2026-11");
    expect(monthKey(new Date("2026-11-30T22:30:00Z"))).toBe("2026-12");
  });
});

describe("markPaid", () => {
  it("майстер не власник — розрахунок не закриває", async () => {
    m.owner = false;
    expect(await markPaid(null, form({ month: "2026-11", fee: "0" }))).toMatch(/власник/);
    expect(fake.writes()).toEqual([]);
  });

  it("місяць уже закрито — вдруге не закривається", async () => {
    fake.onSelect(partnerSettlements, () => [{ id: "s1", periodStart: new Date(), ordersCount: 1, amount: 400, fee: 0, paidAt: new Date(), createdAt: new Date() }]);
    expect(await markPaid(null, form({ month: "2026-11", fee: "0" }))).toMatch(/закрито/);
    expect(fake.writes()).toEqual([]);
  });

  it("утримання більше за суму — помилка", async () => {
    fake.onSelect(leads, () => [issued("l1", 400)]);
    expect(await markPaid(null, form({ month: "2026-11", fee: "500" }))).toMatch(/більше/);
    expect(fake.writes()).toEqual([]);
  });

  it("закриває: сума з прайсу заявок, утримання, заявки привʼязані", async () => {
    fake.onSelect(leads, () => [issued("l1", 400), issued("l2", 1100)]);
    fake.onInsert(partnerSettlements, () => [{ id: "s1" }]);
    expect(await markPaid(null, form({ month: "2026-11", fee: "150" }))).toBeNull();
    const [insert, update] = fake.writes();
    expect(insert.sql).toMatch(/^insert into "partner_settlements"/);
    expect(insert.params).toEqual(expect.arrayContaining([2, 1500, 150]));
    expect(update.sql).toMatch(/^update "leads" set "settlement_id"/);
  });
});

describe("addPrice", () => {
  it("без ціни або з нулем — не додає", async () => {
    expect(await addPrice(null, form({ model: "Redmi 13C", work: "АКБ", price: "0" }))).toMatch(/Ціна/);
    expect(await addPrice(null, form({ model: "Redmi 13C", work: "АКБ", price: "abc" }))).toMatch(/Ціна/);
    expect(fake.writes()).toEqual([]);
  });

  it("додає позицію", async () => {
    expect(await addPrice(null, form({ model: "Redmi 13C", work: "АКБ", price: "400", cost: "250" }))).toBeNull();
    expect(fake.writes()[0].params).toEqual(expect.arrayContaining(["Redmi 13C", "АКБ", 400, 250]));
  });
});
