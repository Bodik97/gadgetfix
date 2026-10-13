/**
 * Український номер у формат E.164 (+380XXXXXXXXX).
 * Приймає те, як люди реально пишуть: 073 315 02 38, 0733150238,
 * +38 (073) 315-02-38, 380733150238, 8 073 315 02 38.
 */
export function normalizeUaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  // 0XXXXXXXXX → 380XXXXXXXXX
  const full =
    digits.length === 10 && digits.startsWith("0")
      ? `38${digits}`
      : digits.length === 9
        ? `380${digits}` // без нуля: 73 315 02 38
        : digits.length === 11 && digits.startsWith("80")
          ? `3${digits}` // по-старому, через вісімку: 8 073 315 02 38
          : digits;

  if (full.length !== 12 || !full.startsWith("380")) return null;

  // Лише мобільні коди операторів. Без цього «380» чи «80», набрані вдруге після
  // готового «+38», давали номер на кшталт +380380731234 — на вигляд повний, а подзвонити нікуди
  if (!MOBILE_CODES.has(full.slice(3, 5))) return null;

  return `+${full}`;
}

/** Коди мобільних операторів України — дві цифри після «+380» */
const MOBILE_CODES = new Set([
  "39", "50", "63", "66", "67", "68", "73", "75", "77", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

/** Для показу: +380731234567 → 073 123 45 67 */
export function formatUaPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length !== 12) return e164;
  // 380731234567 → 0 + 73 123 45 67
  return `0${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

/** Лише цифри — для звірки того, що ввів клієнт */
export function digits(input: string): string {
  return input.replace(/\D/g, "");
}

/** Останні 4 цифри номера: контрольне поле в перевірці статусу */
export function lastFour(phone: string | null | undefined): string | null {
  const d = digits(phone ?? "");
  return d.length >= 4 ? d.slice(-4) : null;
}
