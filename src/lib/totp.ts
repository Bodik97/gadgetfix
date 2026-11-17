import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Одноразові коди для входу (TOTP, RFC 6238) — ті самі, що показують
 * Google Authenticator, 1Password, Authy: 6 цифр, нові кожні 30 секунд.
 *
 * Без сторонніх бібліотек: це HMAC-SHA1 від номера 30-секундного проміжку.
 */

const STEP = 30;
const DIGITS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Секрет TOTP не в base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Код для номера проміжку `counter` (секрет — сирі байти) */
export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const counterAt = (ms: number) => Math.floor(ms / 1000 / STEP);

/**
 * Перевіряє код. Допускаємо сусідній проміжок у кожен бік — годинник
 * телефона рідко йде секунда в секунду. Повертає номер проміжку, на якому
 * код зійшовся (щоб той самий код не прийняти двічі), або null.
 */
export function verifyTotp(secretBase32: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secretBase32);
  const given = Buffer.from(code);
  const base = counterAt(now);
  let matched: number | null = null;
  // Перебираємо всі три проміжки, навіть знайшовши збіг — час відповіді не має нічого видавати
  for (const c of [base - 1, base, base + 1]) {
    if (timingSafeEqual(Buffer.from(hotp(key, c)), given)) matched = c;
  }
  return matched;
}

/** Новий секрет: 20 випадкових байтів, як радить RFC 4226 */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Посилання для QR-коду: додаток сам підтягне назву й секрет */
export function otpauthUrl(secret: string, label: string): string {
  const issuer = "GadgetFix Адмін";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${label}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}
