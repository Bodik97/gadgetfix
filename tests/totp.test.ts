import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, counterAt, hotp, newTotpSecret, verifyTotp } from "@/lib/totp";

/** Одноразові коди мають збігатися з тими, що показує Google Authenticator */

// Тестовий секрет із RFC 6238 (SHA-1): ASCII «12345678901234567890»
const RFC = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP за RFC 6238", () => {
  it("еталонні значення (останні 6 цифр 8-значних кодів з RFC)", () => {
    const key = Buffer.from("12345678901234567890");
    expect(hotp(key, counterAt(59_000))).toBe("287082");
    expect(hotp(key, counterAt(1_111_111_109_000))).toBe("081804");
    expect(hotp(key, counterAt(2_000_000_000_000))).toBe("279037");
  });

  it("base32 туди й назад", () => {
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });

  it("свіжий код приймається, сусідній проміжок (±30 с) — теж", () => {
    const now = 1_700_000_000_000;
    const code = hotp(base32Decode(RFC), counterAt(now));
    expect(verifyTotp(RFC, code, now)).toBe(counterAt(now));
    expect(verifyTotp(RFC, code, now + 30_000)).toBe(counterAt(now));
  });

  it("старий код (дві хвилини тому), не цифри, не 6 знаків — ні", () => {
    const now = 1_700_000_000_000;
    const old = hotp(base32Decode(RFC), counterAt(now - 120_000));
    expect(verifyTotp(RFC, old, now)).toBeNull();
    expect(verifyTotp(RFC, "abcdef", now)).toBeNull();
    expect(verifyTotp(RFC, "12345", now)).toBeNull();
  });
});
