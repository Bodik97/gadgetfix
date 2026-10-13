import { describe, expect, it } from "vitest";
import { plural } from "@/components/account/plural";

/** Українські відмінки після числа: 21 — це «день», а не «днів» */
describe("plural", () => {
  const days = (n: number) => `${n} ${plural(n, "день", "дні", "днів")}`;

  it("один, кілька, багато", () => {
    expect(days(1)).toBe("1 день");
    expect(days(3)).toBe("3 дні");
    expect(days(5)).toBe("5 днів");
    expect(days(0)).toBe("0 днів");
  });

  it("другий десяток — завжди «багато»", () => {
    for (const n of [11, 12, 14, 19, 111, 112]) expect(days(n)).toBe(`${n} днів`);
  });

  it("21, 22, 25 — за останньою цифрою", () => {
    expect(days(21)).toBe("21 день");
    expect(days(22)).toBe("22 дні");
    expect(days(25)).toBe("25 днів");
    expect(days(181)).toBe("181 день");
  });

  it("посилки в дорозі", () => {
    const parcels = (n: number) => `${n} ${plural(n, "посилка", "посилки", "посилок")}`;
    expect(parcels(1)).toBe("1 посилка");
    expect(parcels(2)).toBe("2 посилки");
    expect(parcels(5)).toBe("5 посилок");
  });
});
