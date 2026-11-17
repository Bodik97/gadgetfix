import { describe, expect, it } from "vitest";
import { isUuid, readExternalNo, readImei, readUah, sniffImage } from "@/lib/validate";

/**
 * Обовʼязкова перевірка вводу: сервер не вірить формі на слово —
 * запит можна надіслати й повз неї.
 */

describe("readUah — гроші", () => {
  it("ціле число, пробіли між тисячами й «₴» дозволені", () => {
    expect(readUah("1950")).toBe(1950);
    expect(readUah("1 950 ₴")).toBe(1950);
    expect(readUah("2900 грн")).toBe(2900);
    expect(readUah("")).toBeNull();
  });

  it("дроби, мінус, експонента, текст, понад мільйон — ні", () => {
    for (const bad of ["19.5", "-100", "1e3", "abc", "1950abc", "0x10", "2000000"]) expect(readUah(bad)).toBeUndefined();
  });
});

describe("readImei", () => {
  it("15 цифр, з пробілами теж", () => {
    expect(readImei("35 291611 482019 7")).toBe("352916114820197");
  });
  it("літери чи замало цифр — ні; порожньо — можна", () => {
    expect(readImei("35291161148201A")).toBeUndefined();
    expect(readImei("12345")).toBeUndefined();
    expect(readImei("")).toBeNull();
  });
});

describe("readExternalNo — № магазину", () => {
  it("будь-який запис цифр → «М-…»", () => {
    expect(readExternalNo("М-4486")).toBe("М-4486");
    expect(readExternalNo("m4486")).toBe("М-4486");
    expect(readExternalNo(" 4486 ")).toBe("М-4486");
  });
  it("текст і скрипти — ні", () => {
    expect(readExternalNo("<script>")).toBeUndefined();
    expect(readExternalNo("М-44 86")).toBeUndefined();
  });
});

describe("isUuid", () => {
  it("лише справжній id", () => {
    expect(isUuid("11111111-1111-1111-1111-111111111111")).toBe(true);
    expect(isUuid("1' or '1'='1")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("sniffImage — що насправді у файлі", () => {
  const file = (bytes: number[] | string) =>
    new Blob([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], { type: "image/png" });

  it("впізнає JPEG, PNG, WebP", async () => {
    expect(await sniffImage(file([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(await sniffImage(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
    expect(await sniffImage(file("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("HTML, перейменований на .png, — не фото", async () => {
    expect(await sniffImage(file("<html><script>alert(1)</script>"))).toBeNull();
  });
});
