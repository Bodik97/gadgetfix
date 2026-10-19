import { describe, expect, it } from "vitest";
import { reviewDevice } from "@/data/deviceImage";

/** Фото моделі біля відгуку: з поля «Модель», а якщо порожньо — з тексту */
describe("reviewDevice", () => {
  it("поле «Модель» — головне джерело", () => {
    expect(reviewDevice("iPhone 14 Pro", "айфон 11")).toEqual({
      name: "iPhone 14 Pro",
      image: "/models/iphone-14-pro.webp",
    });
  });

  it("модель згадана в тексті — фото й назва з каталогу", () => {
    expect(reviewDevice(null, "Міняли батерею на айфон 15 про , зробили швидко").name).toBe("iPhone 15 Pro");
    expect(reviewDevice(null, "Дякую! iPhone 13 Pro Max як новий").name).toBe("iPhone 13 Pro Max");
    expect(reviewDevice(null, "Айфону 11 замінили екран").name).toBe("iPhone 11");
  });

  it("модель не названо — фото немає", () => {
    expect(reviewDevice(null, "Швидко, айфон, дякую")).toEqual({ name: null, image: null });
    expect(reviewDevice(null, "Ремонт Samsung A52")).toEqual({ name: null, image: null });
  });
});
