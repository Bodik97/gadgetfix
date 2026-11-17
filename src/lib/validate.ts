/**
 * Перевірка того, що люди вписують у форми. Одні й ті самі правила для
 * браузера й сервера: поле не дає набрати зайве, а сервер не вірить на слово
 * й перевіряє ще раз — запит можна надіслати й повз форму.
 */

import { normalizeUaPhone } from "./phone";

export const LIMITS = {
  name: { min: 2, max: 50 },
  /** Місто й відділення Нової Пошти */
  place: { min: 3, max: 100 },
  /** Модель чи послуга, вписані вручну */
  short: 80,
  /** «Що трапилось» */
  problem: 500,
} as const;

/** Не літера, не апостроф, не дефіс і не пробіл — в імені зайве */
const NOT_NAME = /[^\p{L}'’ʼ\- ]/gu;
/** Усе, крім літер, цифр, пробілів і звичайної пунктуації: <>{}[]\|^~`$, емодзі, керівні символи */
const NOT_TEXT = /[^\p{L}\p{N} \n.,!?:;()"'’ʼ«»\-–—+№%/&@#]/gu;

/** Імʼя під час набору: лише літери, апостроф, дефіс і одинарні пробіли */
export function onlyLetters(value: string): string {
  return value.replace(NOT_NAME, "").replace(/ {2,}/g, " ").replace(/^ /, "").slice(0, LIMITS.name.max);
}

/** Імʼя годиться: від двох літер, без цифр і знаків */
export function validName(value: string): boolean {
  const v = value.trim();
  return (
    v.length <= LIMITS.name.max &&
    !new RegExp(NOT_NAME.source, "u").test(v) &&
    (v.match(/\p{L}/gu)?.length ?? 0) >= LIMITS.name.min
  );
}

/** Вільний текст: без спецсимволів і не довший за `max`. Абзаци лишаються, якщо `multiline` */
export function plainText(value: string, max: number, multiline = false): string {
  const flat = multiline ? value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n") : value.replace(/\s+/g, " ");
  return flat.replace(/\t/g, " ").replace(NOT_TEXT, "").replace(/ {2,}/g, " ").replace(/^\s+/, "").slice(0, max);
}

/**
 * Що не так із полем — словами для людини; null, коли все гаразд.
 * Ці ж тексти показує форма під полем.
 */
export function nameProblem(value: string): string | null {
  if (!value.trim()) return "Впишіть імʼя — як до вас звертатись.";
  return validName(value) ? null : "Імʼя — щонайменше дві літери, без цифр і знаків.";
}

/** `value` — «+380731234567» або частина, як його віддає поле телефону */
export function phoneProblem(value: string): string | null {
  const local = value.replace(/\D/g, "").replace(/^38/, "");
  if (!local) return "Впишіть номер телефону — після +38 починайте з 0.";

  const missing = 10 - local.length;
  if (missing > 0) {
    const word = missing === 1 ? "цифру" : missing < 5 ? "цифри" : "цифр";
    return `Допишіть номер: бракує ще ${missing} ${word}.`;
  }
  return normalizeUaPhone(value) ? null : "Перевірте номер: такого коду оператора немає.";
}

export function placeProblem(value: string): string | null {
  return value.trim().length >= LIMITS.place.min ? null : "Впишіть місто й номер відділення Нової Пошти.";
}

/** id з бази (UUID). Кривий id з форми інакше падав би помилкою бази замість тихої відмови */
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Сума в гривнях: ціле від 0 до мільйона, пробіли між тисячами дозволені.
 * null — поле порожнє, undefined — вписано щось не те.
 */
export function readUah(raw: string): number | null | undefined {
  const v = raw.replace(/[\s ₴]/g, "").replace(/грн\.?$/i, "");
  if (v === "") return null;
  if (!/^\d{1,7}$/.test(v)) return undefined;
  const n = Number(v);
  return n <= 1_000_000 ? n : undefined;
}

/** IMEI — 15 цифр (інколи пишуть із пробілами або 14/16 — приймаємо 14–16) */
export function readImei(raw: string): string | null | undefined {
  const digits = raw.replace(/[\s-]/g, "");
  if (digits === "") return null;
  return /^\d{14,16}$/.test(digits) ? digits : undefined;
}

/** № квитанції магазину: «М-4486», «м4486», «4486» → «М-4486» */
export function readExternalNo(raw: string): string | undefined {
  const m = /^\s*[мm]?\s*-?\s*(\d{1,8})\s*$/i.exec(raw);
  return m ? `М-${m[1]}` : undefined;
}

/**
 * Що насправді у файлі — за першими байтами, а не за типом, який назвав браузер:
 * так у сховище не потрапить, скажімо, HTML, перейменований на .png.
 */
export async function sniffImage(file: Blob): Promise<"image/jpeg" | "image/png" | "image/webp" | "image/heic" | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1)$/.test(ascii(8, 12))) return "image/heic";
  return null;
}
