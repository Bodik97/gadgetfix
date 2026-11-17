import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { fake } from "./helpers/fakeDb";
import { leadItems, leadPhotos, leads, leadSignatures } from "@/db/schema";

/**
 * Сторінка заявки: головна кнопка не пускає далі без обовʼязкового (ТЗ 3.3),
 * а гроші не можна змінити мовчки після оплати.
 */

const m = vi.hoisted(() => ({
  admin: true as boolean,
  told: [] as string[],
  offered: 0,
  closed: 0,
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
  offerPrice: async () => {
    m.offered++;
    return true;
  },
}));
vi.mock("@/lib/statusPush", () => ({ pushStatusToClient: async () => {} }));
vi.mock("@/lib/handover", () => ({
  closeOrder: async (lead: unknown) => {
    m.closed++;
    return lead;
  },
}));
vi.mock("@/lib/photoPair", () => ({ savePhoto: async () => "leads/x/1" }));
vi.mock("@/db/discounts", () => ({ releaseDiscount: async () => {} }));

import { addItem, advance, pause, refuse, saveList, savePrepayment } from "@/app/admin/zayavky/[id]/actions";

const ID = "11111111-1111-1111-1111-111111111111";
const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

const LEAD = {
  id: ID,
  orderNo: 1092,
  name: "Олена",
  channel: "own",
  stage: "new",
  status: "new",
  flag: null,
  ttn: null,
  assignee: null,
  paidAt: null,
  paymentMethod: null,
  issuedAt: null,
  problems: [],
  condition: [],
  kit: [],
  source: "manual",
  createdAt: new Date("2026-11-10T10:00:00Z"),
  updatedAt: new Date("2026-11-10T10:00:00Z"),
};

/** Рядок заявки з усіма колонками в порядку таблиці — для update … returning() */
const fullRow = (over: Record<string, unknown> = {}) => {
  const row: Record<string, unknown> = { ...LEAD, ...over };
  return Object.fromEntries(
    Object.entries(getTableColumns(leads)).map(([key, col]) => [
      key,
      key in row ? row[key] : col.columnType === "PgArray" ? [] : null,
    ]),
  );
};

const updates = () => fake.writes().filter((q) => q.sql.startsWith('update "leads"'));

beforeEach(() => {
  fake.reset();
  m.admin = true;
  m.told = [];
  m.offered = 0;
  m.closed = 0;
  fake.onUpdate(leads, () => [fullRow()]);
});

describe("advance — головна кнопка", () => {
  it("без входу — на сторінку входу", async () => {
    m.admin = false;
    await expect(advance(null, form({ id: ID }))).rejects.toThrow("REDIRECT:/admin/vhid");
  });

  it("«Прийняти» без фото й підпису — підказка, етап той самий", async () => {
    fake.onSelect(leads, () => [LEAD]);
    fake.onSelect(leadPhotos, () => [{ n: 0 }]);
    fake.onSelect(leadSignatures, () => [{ n: 0 }]);
    expect(await advance(null, form({ id: ID }))).toMatch(/фото.*підпис/);
    expect(updates()).toEqual([]);
  });

  it("з фото, але без підпису — просить підпис", async () => {
    fake.onSelect(leads, () => [LEAD]);
    fake.onSelect(leadPhotos, () => [{ n: 2 }]);
    fake.onSelect(leadSignatures, () => [{ n: 0 }]);
    expect(await advance(null, form({ id: ID }))).toMatch(/підпис/);
  });

  it("фото й підпис є — на діагностику", async () => {
    fake.onSelect(leads, () => [LEAD]);
    fake.onSelect(leadPhotos, () => [{ n: 1 }]);
    fake.onSelect(leadSignatures, () => [{ n: 1 }]);
    expect(await advance(null, form({ id: ID }))).toBeNull();
    expect(updates()[0].params).toEqual(expect.arrayContaining(["diagnostics"]));
  });

  it("«Надіслати ціну» без жодної роботи — не пускає", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, stage: "diagnostics" }]);
    fake.onSelect(leadItems, () => [{ n: 0 }]);
    expect(await advance(null, form({ id: ID }))).toMatch(/роботу/);
    expect(m.offered).toBe(0);
  });

  it("з роботою — погодження й ціна клієнту в Telegram", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, stage: "diagnostics", price: 1950 }]);
    fake.onSelect(leadItems, () => [{ n: 1 }]);
    expect(await advance(null, form({ id: ID }))).toBeNull();
    expect(updates()[0].params).toEqual(expect.arrayContaining(["approval"]));
    expect(m.offered).toBe(1);
  });

  it("«Видати» без усіх пунктів перевірки — не видає", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, stage: "ready", status: "ready", paymentMethod: "cash" }]);
    fake.onSelect(leadSignatures, () => [{ n: 1 }]);
    expect(await advance(null, form({ id: ID, check: ["Зарядка", "Екран"] }))).toMatch(/Перевірте/);
    expect(m.closed).toBe(0);
  });

  it("усе перевірено, оплата обрана, підпис є — закриває заявку", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, stage: "ready", status: "ready", paymentMethod: "card" }]);
    fake.onSelect(leadSignatures, () => [{ n: 1 }]);
    const all = ["Зарядка", "Екран", "Face ID / Touch ID", "Камери", "Звук", "Мережа"];
    expect(await advance(null, form({ id: ID, check: all }))).toBeNull();
    expect(m.closed).toBe(1);
  });

  it("без способу оплати — просить обрати", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, stage: "ready", status: "ready" }]);
    const all = ["Зарядка", "Екран", "Face ID / Touch ID", "Камери", "Звук", "Мережа"];
    expect(await advance(null, form({ id: ID, check: all }))).toMatch(/платить/);
  });

  it("на паузі — спершу «Продовжити»", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, flag: "paused" }]);
    expect(await advance(null, form({ id: ID }))).toMatch(/Продовжити/);
    expect(updates()).toEqual([]);
  });

  it("«Онлайн» — без фото й підпису одразу в роботу", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, channel: "online" }]);
    expect(await advance(null, form({ id: ID }))).toBeNull();
    expect(updates()[0].params).toEqual(expect.arrayContaining(["in_progress"]));
    // Магазину не пишемо
    expect(m.told).toEqual([]);
  });
});

describe("гроші", () => {
  it("передоплата — лише ціле додатне число", async () => {
    expect(await savePrepayment(form({ id: ID, amount: "-5" }))).toMatch(/ціле/);
    expect(await savePrepayment(form({ id: ID, amount: "abc" }))).toMatch(/ціле/);
    expect(fake.writes()).toEqual([]);
  });

  it("передоплата з сумою ставить і дату — галочки «внесено 0 ₴» більше немає", async () => {
    expect(await savePrepayment(form({ id: ID, amount: "300" }))).toBeNull();
    expect(updates()[0].sql).toMatch(/"prepayment" = \$1, "prepaid_at" = \$2/);
    expect(updates()[0].params[0]).toBe(300);
  });

  it("після оплати роботу не додати", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, paidAt: new Date() }]);
    expect(await addItem(form({ id: ID, kind: "work", title: "Екран", price: "100" }))).toMatch(/оплачено/);
    expect(fake.writes()).toEqual([]);
  });
});

describe("чипи й відмова", () => {
  it("зберігаються лише значення зі списку", async () => {
    await saveList(form({ id: ID, field: "problems", value: ["Екран", "<script>", "Батарея"] }));
    expect(updates()[0].params[0]).toBe('{"Екран","Батарея"}');
  });

  it("невідоме поле — нічого не пише", async () => {
    await saveList(form({ id: ID, field: "status", value: ["done"] }));
    expect(fake.writes()).toEqual([]);
  });

  it("відмова: позначка, статус «rejected», клієнт дізнається", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, stage: "approval" }]);
    await refuse(form({ id: ID }));
    expect(updates()[0].params).toEqual(expect.arrayContaining(["refused", "rejected"]));
    expect(m.told).toEqual(["rejected"]);
  });
});

describe("пауза", () => {
  it("без причини — не ставиться", async () => {
    expect(await pause(form({ id: ID, reason: "  " }))).toMatch(/чекаємо/);
    expect(fake.writes()).toEqual([]);
  });

  it("з причиною — позначка й причина в заявці", async () => {
    expect(await pause(form({ id: ID, reason: "чекаємо оплату" }))).toBeNull();
    expect(updates()[0].params).toEqual(expect.arrayContaining(["paused", "чекаємо оплату"]));
  });
});
