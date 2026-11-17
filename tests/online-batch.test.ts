import { describe, expect, it } from "vitest";
import { parseBatch } from "@/lib/onlineBatch";

/** Прийом пачкою: магазин пише як зручно — ми маємо впізнати № і позицію з прайсу */

const PRICES = [
  { id: "a", model: "Redmi 13C", work: "АКБ" },
  { id: "b", model: "iPhone 13 Pro", work: "не заряджається" },
  { id: "c", model: "iPhone 13 Pro Max", work: "кришка" },
  { id: "d", model: "Samsung A36", work: "дисплей" },
];

describe("parseBatch", () => {
  it("звичайний рядок: № магазину й позиція", () => {
    expect(parseBatch("М-4486 Redmi 13C АКБ", PRICES)).toEqual([
      { ok: true, line: "М-4486 Redmi 13C АКБ", externalNo: "М-4486", priceId: "a", note: null },
    ]);
  });

  it("без «М-», малими літерами, з тире й приміткою", () => {
    const [r] = parseBatch("4490 — redmi 13c акб, тріснуте скло", PRICES);
    expect(r).toMatchObject({ ok: true, externalNo: "М-4490", priceId: "a", note: "тріснуте скло" });
  });

  it("«Pro Max» не плутається з «Pro»", () => {
    const [r] = parseBatch("М-1 iPhone 13 Pro Max кришка", PRICES);
    expect(r).toMatchObject({ ok: true, priceId: "c" });
  });

  it("невідомий рядок і рядок без № — у звіт, а не в базу", () => {
    const res = parseBatch("М-5 Nokia 3310 антена\nRedmi 13C АКБ\n\n", PRICES);
    expect(res).toEqual([
      { ok: false, line: "М-5 Nokia 3310 антена", reason: "не знайшли в прайсі" },
      { ok: false, line: "Redmi 13C АКБ", reason: "немає № магазину на початку" },
    ]);
  });

  it("не більше 50 рядків за раз", () => {
    const many = Array.from({ length: 80 }, (_, i) => `М-${100 + i} Redmi 13C АКБ`).join("\n");
    expect(parseBatch(many, PRICES)).toHaveLength(50);
  });
});
