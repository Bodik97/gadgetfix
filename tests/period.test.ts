import { afterEach, describe, expect, it, vi } from "vitest";
import { dayString, isPeriod, PERIODS, resolveRange } from "@/app/admin/groshi/period";
import { kyivDayStart, monthStart } from "@/lib/month";

/**
 * Каса рахує гроші за проміжок. Помилка на один день тут — це неправильний
 * підсумок місяця, і помітять її не одразу.
 *
 * Сервер живе за UTC, сервіс — за київським часом. Тому всі межі тут задані
 * точними миттями в UTC: тест має однаково проходити й на сервері, і на
 * ноутбуці в будь-якому поясі. Геттери на кшталт getDate() цього не
 * перевіряють — вони рахують у поясі машини.
 */
const at = (iso: string) => vi.useFakeTimers({ now: new Date(iso), toFake: ["Date"] });
const iso = (d: Date | undefined) => d?.toISOString();

afterEach(() => vi.useRealTimers());

describe("межі за київським часом", () => {
  it("22:30 UTC 31 жовтня — у Києві вже 00:30 1 листопада: місяць — листопад", () => {
    at("2026-10-31T22:30:00Z");
    // Початок листопада в Києві (зимовий час, UTC+2) — це 22:00 UTC 31 жовтня
    expect(iso(monthStart())).toBe("2026-10-31T22:00:00.000Z");
    expect(resolveRange({}).fromDay).toBe("2026-11-01");
    expect(resolveRange({}).toDay).toBe("2026-11-01");
  });

  it("за пів години до того — ще жовтень, і він починався за літнім часом", () => {
    at("2026-10-31T21:59:00Z");
    // 1 жовтня ще літній час (UTC+3): північ у Києві — це 21:00 UTC 30 вересня
    expect(iso(monthStart())).toBe("2026-09-30T21:00:00.000Z");
  });

  it("оплата о 01:30 за Києвом 1 листопада потрапляє в листопад, а не в жовтень", () => {
    at("2026-11-15T12:00:00Z");
    const paidAt = new Date("2026-10-31T23:30:00Z");

    const november = resolveRange({});
    expect(paidAt.getTime()).toBeGreaterThanOrEqual(november.from.getTime());

    const october = resolveRange({ period: "prev" });
    expect(paidAt.getTime()).toBeGreaterThanOrEqual(october.to!.getTime());
    expect(iso(october.from)).toBe("2026-09-30T21:00:00.000Z");
    expect(iso(october.to)).toBe("2026-10-31T22:00:00.000Z");
    expect(october.fromDay).toBe("2026-10-01");
    expect(october.toDay).toBe("2026-10-31");
  });

  it("місяці назад переходять через рік", () => {
    at("2026-01-10T12:00:00Z");
    expect(iso(monthStart(1))).toBe("2025-11-30T22:00:00.000Z");
    expect(iso(monthStart(2))).toBe("2025-10-31T22:00:00.000Z");
  });

  it("«цей рік» починається опівночі 1 січня в Києві — навіть коли в UTC ще торішнє 31 грудня", () => {
    at("2026-12-31T22:30:00Z");
    expect(iso(resolveRange({ period: "year" }).from)).toBe("2026-12-31T22:00:00.000Z");
  });

  it("вибрані дати — київські дні: у день переведення годинника доба має 25 або 23 години", () => {
    // 25 жовтня 2026 годинник переводять назад
    const autumn = resolveRange({ from: "2026-10-25", to: "2026-10-25" });
    expect(iso(autumn.from)).toBe("2026-10-24T21:00:00.000Z");
    expect(iso(autumn.to)).toBe("2026-10-25T22:00:00.000Z");

    // 29 березня 2026 — вперед
    const spring = resolveRange({ from: "2026-03-29", to: "2026-03-29" });
    expect(iso(spring.from)).toBe("2026-03-28T22:00:00.000Z");
    expect(iso(spring.to)).toBe("2026-03-29T21:00:00.000Z");
  });

  it("dayString — день у Києві, а не в UTC і не в поясі машини", () => {
    expect(dayString(new Date("2026-10-31T21:59:59Z"))).toBe("2026-10-31");
    expect(dayString(new Date("2026-10-31T22:00:00Z"))).toBe("2026-11-01");
    // Улітку Київ на три години попереду
    expect(dayString(new Date("2026-06-30T21:00:00Z"))).toBe("2026-07-01");
    expect(dayString(kyivDayStart(2026, 1, 1))).toBe("2026-01-01");
    expect(dayString(kyivDayStart(2026, 12, 31))).toBe("2026-12-31");
  });

  it("форма витрат між північчю і третьою ночі за Києвом пропонує вже сьогоднішню дату", () => {
    at("2026-07-14T21:30:00Z"); // 00:30 15 липня в Києві
    expect(dayString(new Date())).toBe("2026-07-15");
  });
});

describe("проміжок каси", () => {
  it("за замовчуванням — поточний місяць", () => {
    at("2026-05-20T09:00:00Z");
    const r = resolveRange({});
    expect(r.label).toBe("Цей місяць");
    expect(r.fromDay).toBe("2026-05-01");
    expect(r.to).toBeUndefined();
    expect(r.toDay).toBe("2026-05-20");
  });

  it("невідомий період не ламає вибірку", () => {
    expect(resolveRange({ period: "казна-що" }).label).toBe("Цей місяць");
    expect(isPeriod("казна-що")).toBe(false);
    for (const p of PERIODS) expect(isPeriod(p.value)).toBe(true);
  });

  it("кінцевий день входить у проміжок повністю", () => {
    const r = resolveRange({ from: "2026-03-01", to: "2026-03-31" });
    // `to` — межа «до», не включно, тож це має бути початок 1 квітня
    expect(r.to).toBeDefined();
    expect(dayString(r.to!)).toBe("2026-04-01");
    expect(r.toDay).toBe("2026-03-31");
  });

  it("дати мають перевагу над готовим періодом", () => {
    const r = resolveRange({ period: "year", from: "2026-05-10", to: "2026-05-20" });
    expect(r.label).toBe("вибрані дати");
    expect(r.fromDay).toBe("2026-05-10");
  });

  it("одна дата без другої теж працює", () => {
    const only = resolveRange({ from: "2026-07-04" });
    expect(only.fromDay).toBe("2026-07-04");
    expect(only.to).toBeUndefined();
  });

  it("минулий місяць має обидві межі й не залазить у поточний", () => {
    at("2024-04-10T09:00:00Z");
    const r = resolveRange({ period: "prev" });
    expect(r.fromDay).toBe("2024-03-01");
    // 31 березня 2024 — день переведення годинника: останній день місяця не має загубитись
    expect(r.toDay).toBe("2024-03-31");
    expect(dayString(r.to!)).toBe("2024-04-01");
  });
});
