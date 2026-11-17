import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { leads, partnerPrices } from "@/db/schema";

/**
 * Кнопки на дошці «Заявки». Переходи вирішує сервер: з форми приходять лише
 * id і бажаний етап, і чужий перехід (стара вкладка, підроблена форма)
 * нічого не змінює. Клієнту пишемо лише тоді, коли змінився його статус.
 */

const m = vi.hoisted(() => ({
  admin: true as boolean,
  told: [] as string[],
  pushed: [] as string[],
}));

vi.mock("@/db", () => ({ getDb: () => fake.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/admin", () => ({
  currentAdmin: async () => (m.admin ? { name: "Богдан", email: "b@x.ua", role: "owner" } : null),
}));
vi.mock("@/lib/clientBot", () => ({
  notifyClientStatus: async (lead: { status: string }) => {
    m.told.push(lead.status);
    return true;
  },
}));
vi.mock("@/lib/statusPush", () => ({
  pushStatusToClient: async (_lead: unknown, next: string) => {
    m.pushed.push(next);
  },
}));

import { createOnlineLead, moveStage } from "@/app/admin/zayavky/actions";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

const BASE = {
  id: "11111111-1111-1111-1111-111111111111",
  orderNo: 1092,
  name: "Олена",
  channel: "own",
  stage: "approval",
  status: "new",
  flag: null,
  ttn: null,
  assignee: null,
  issuedAt: null,
  problems: [],
  condition: [],
  kit: [],
  source: "manual",
  createdAt: new Date("2026-11-10T10:00:00Z"),
  updatedAt: new Date("2026-11-10T10:00:00Z"),
};

const updates = () => fake.writes().filter((q) => q.sql.startsWith('update "leads"'));
const events = () => fake.writes().filter((q) => q.sql.startsWith('insert into "lead_events"'));

beforeEach(() => {
  fake.reset();
  m.admin = true;
  m.told = [];
  m.pushed = [];
  fake.onUpdate(leads, () => [{ id: BASE.id }]);
});

describe("moveStage", () => {
  it("без входу — на сторінку входу, база не чіпається", async () => {
    m.admin = false;
    await expect(moveStage(form({ id: BASE.id, to: "in_progress" }))).rejects.toThrow("REDIRECT:/admin/vhid");
    expect(fake.writes()).toEqual([]);
  });

  it("«Погодив»: у роботу, клієнт дізнається (статус змінився)", async () => {
    fake.onSelect(leads, () => [BASE]);
    await moveStage(form({ id: BASE.id, to: "in_progress" }));
    expect(updates()).toHaveLength(1);
    expect(updates()[0].params).toEqual(expect.arrayContaining(["in_progress"]));
    expect(m.told).toEqual(["in_progress"]);
    expect(m.pushed).toEqual(["in_progress"]);
    expect(events()).toHaveLength(1);
  });

  it("перехід, якого немає в наступній дії, нічого не робить", async () => {
    fake.onSelect(leads, () => [BASE]);
    // З «Погодження» стрибнути одразу у «Видано» не можна
    await moveStage(form({ id: BASE.id, to: "issued" }));
    expect(fake.writes()).toEqual([]);
    expect(m.told).toEqual([]);
  });

  it("«Взяти собі» з нової: діагностика, майстер призначений, клієнту нічого (статус той самий)", async () => {
    fake.onSelect(leads, () => [{ ...BASE, stage: "new" }]);
    await moveStage(form({ id: BASE.id, to: "diagnostics" }));
    expect(updates()[0].params).toEqual(expect.arrayContaining(["diagnostics", "b@x.ua"]));
    expect(m.told).toEqual([]);
    // Подія лише для адмінки: з етапом, без статусу
    expect(events()).toHaveLength(1);
  });

  it("«Онлайн» → «Віддати»: заявка видана, клієнту магазину не пишемо", async () => {
    fake.onSelect(leads, () => [{ ...BASE, channel: "online", stage: "ready", status: "ready", onlineNo: 5 }]);
    await moveStage(form({ id: BASE.id, to: "issued" }));
    expect(updates()[0].params).toEqual(expect.arrayContaining(["issued", "done", 30]));
    // Гарантія магазину — місяць від сьогодні
    const until = updates()[0].params.find((v) => typeof v === "string" && /^\d{4}-/.test(v) && v > new Date(Date.now() + 29 * 864e5).toISOString());
    expect(until).toBeDefined();
    expect(m.told).toEqual([]);
    expect(m.pushed).toEqual([]);
  });

  it("заявку вже рухнули з іншого телефона — подію не пишемо", async () => {
    fake.reset();
    fake.onUpdate(leads, () => []);
    fake.onSelect(leads, () => [BASE]);
    await moveStage(form({ id: BASE.id, to: "in_progress" }));
    expect(events()).toEqual([]);
    expect(m.told).toEqual([]);
  });
});

describe("createOnlineLead", () => {
  const PRICE = {
    id: "22222222-2222-2222-2222-222222222222",
    model: "Redmi 13C",
    work: "АКБ",
    price: 400,
    cost: 250,
    active: true,
    createdAt: new Date(),
  };

  it("без № магазину — підказка, нічого не створено", async () => {
    expect(await createOnlineLead(null, form({ externalNo: " ", priceId: PRICE.id }))).toMatch(/№/);
    expect(fake.writes()).toEqual([]);
  });

  it("робота не з прайсу — відмова", async () => {
    fake.onSelect(partnerPrices, () => []);
    expect(await createOnlineLead(null, form({ externalNo: "М-1", priceId: PRICE.id }))).toMatch(/прайсу/);
    expect(fake.writes()).toEqual([]);
  });

  it("той самий № магазину вже в роботі — вдруге не приймаємо", async () => {
    fake.onSelect(partnerPrices, () => [PRICE]);
    fake.onSelect(leads, () => [{ id: "x" }]);
    expect(await createOnlineLead(null, form({ externalNo: "М-4486", priceId: PRICE.id }))).toMatch(/уже прийнято/);
    expect(fake.writes()).toEqual([]);
  });

  it("ціна й собівартість — з прайсу магазину, а не з форми", async () => {
    fake.onSelect(partnerPrices, () => [PRICE]);
    const res = await createOnlineLead(
      null,
      form({ externalNo: "М-4486", priceId: PRICE.id, price: "1", note: "тріснуте скло" }),
    );
    expect(res).toBeNull();
    const insert = fake.writes().find((q) => q.sql.startsWith('insert into "leads"'))!;
    expect(insert.sql).toContain("nextval('online_no_seq')");
    expect(insert.params).toEqual(expect.arrayContaining(["online", "М-4486", "Redmi 13C", "АКБ", 400, 250]));
  });
});
