import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { claims } from "./helpers/claimingDb";
import { devices, leadEvents, leads } from "@/db/schema";

/**
 * Стеження за посилкою: заявка закривається й гарантія стартує лише тоді,
 * коли Нова Пошта каже «отримано». Збій звʼязку — не привід закривати.
 */

vi.mock("@/db", async () => {
  const { claimingDb } = await import("./helpers/claimingDb");
  return { getDb: () => claimingDb };
});
vi.mock("workflow", () => ({ sleep: async () => {} }));

import { checkParcel } from "@/workflows/watch-parcel";
import { parcelReceived } from "@/lib/novaPoshta";

const LEAD = {
  id: "11111111-1111-1111-1111-111111111111",
  orderNo: 1001,
  name: "Олег",
  phone: "0733150238",
  service: "Заміна екрана",
  status: "shipped",
  ttn: "20450000000000",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const np = (code: string | null) =>
  vi.stubGlobal("fetch", async () => {
    if (code === null) throw new Error("network");
    return Response.json({ success: true, data: [{ StatusCode: code }] });
  });

beforeEach(() => {
  fake.reset();
  claims.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

const closed = () => fake.writes().some((q) => q.sql.startsWith('update "leads"') && q.params.includes("done"));
const inserted = (table: string) => fake.writes().filter((q) => q.sql.startsWith(`insert into "${table}"`));

describe("посилка Новою Поштою", () => {
  it("«отримано» — так, «у дорозі» — ні, без звʼязку — невідомо", async () => {
    np("9");
    expect(await parcelReceived("2045 0000 0000 00")).toBe(true);
    np("7");
    expect(await parcelReceived("20450000000000")).toBe(false);
    np(null);
    expect(await parcelReceived("20450000000000")).toBeNull();
  });

  it("клієнт забрав посилку — заявка закривається, стартує гарантія", async () => {
    fake.onSelect(leads, () => [LEAD]);
    np("9");
    expect(await checkParcel(LEAD.id, LEAD.ttn)).toBe("closed");
    expect(closed()).toBe(true);
    expect(fake.writes().find((q) => q.sql.startsWith('update "leads"'))!.sql).toContain('"warranty_until"');
  });

  it("посилка ще в дорозі або Нова Пошта мовчить — чекаємо далі, нічого не закриваємо", async () => {
    fake.onSelect(leads, () => [LEAD]);
    np("7");
    expect(await checkParcel(LEAD.id, LEAD.ttn)).toBe("wait");
    np(null);
    expect(await checkParcel(LEAD.id, LEAD.ttn)).toBe("wait");
    expect(closed()).toBe(false);
  });

  it("заявку вже закрили як слід або накладну замінили — стеження припиняється, нічого не дублюється", async () => {
    claims.rows = []; // заявка вже «done» — умовний UPDATE нічого не змінює
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", clerkUserId: "user_1", warrantyUntil: new Date("2027-01-01T10:00:00Z") }]);
    fake.onSelect(leadEvents, () => [{ at: new Date("2026-10-03T10:00:00Z") }]);
    fake.onSelect(devices, () => [{ id: "d1" }]);
    np("9");
    expect(await checkParcel(LEAD.id, LEAD.ttn)).toBe("stop");
    expect(inserted("lead_events")).toEqual([]);
    expect(inserted("devices")).toEqual([]);

    fake.reset();
    fake.onSelect(leads, () => [{ ...LEAD, ttn: "59000000000000" }]);
    expect(await checkParcel(LEAD.id, LEAD.ttn)).toBe("stop");
    expect(fake.writes()).toEqual([]);

    fake.reset();
    fake.onSelect(leads, () => [{ ...LEAD, status: "rejected" }]);
    expect(await checkParcel(LEAD.id, LEAD.ttn)).toBe("stop");
    expect(fake.writes()).toEqual([]);
  });

  it("крок упав одразу після статусу «done» — повтор доробляє подію й пристрій, а не мовчки зупиняється", async () => {
    claims.rows = [];
    // Статус уже «done», але події в хроніці й пристрою в кабінеті ще немає
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", clerkUserId: "user_1", warrantyUntil: new Date("2027-01-01T10:00:00Z") }]);
    fake.onSelect(devices, () => []);
    np("9");

    expect(await checkParcel(LEAD.id, LEAD.ttn)).toBe("stop");
    expect(inserted("lead_events")).toHaveLength(1);
    expect(inserted("devices")).toHaveLength(1);
  });

  it("клієнт натиснув «отримав» тієї ж миті — закриває лише один, другий події не пише", async () => {
    // Рядок прочитано ще «shipped», але умовний UPDATE уже нічого не знайшов
    claims.rows = [];
    const done = { ...LEAD, status: "done", warrantyUntil: new Date("2027-01-01T10:00:00Z") };
    fake.onSelect(leads, () => [fake.queries.length > 1 ? done : LEAD]);
    fake.onSelect(leadEvents, () => [{ at: new Date() }]);
    np("9");

    expect(await checkParcel(LEAD.id, LEAD.ttn)).toBe("closed");
    expect(inserted("lead_events")).toEqual([]);
  });
});
