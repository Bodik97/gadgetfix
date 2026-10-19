/**
 * Знижки клієнта: 5% за реєстрацію — на перший ремонт, 10% за схвалений відгук
 * із фото — на наступний, 10% біля дня народження — раз на рік. На одну заявку
 * діє одна знижка.
 */
export const DISCOUNT_PERCENT = { signup: 5, review: 10, birthday: 10 } as const;

export type DiscountKind = keyof typeof DISCOUNT_PERCENT;

/** За що знижка — для підписів: «−5% за реєстрацію» */
export const DISCOUNT_REASON: Record<DiscountKind, string> = {
  signup: "за реєстрацію",
  review: "за відгук",
  birthday: "до дня народження",
};

/** Скільки днів до і після дня народження діє знижка */
export const BIRTHDAY_WINDOW_DAYS = 7;

/** «YYYY-MM-DD» — так дата народження лежить у профілі */
export const BIRTHDAY_RE = /^(19|20)\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Чи сьогодні в межах тижня до або після дня народження. Дивимось і на
 * сусідні роки — щоб 28 грудня діяла знижка за день народження 2 січня.
 */
export function inBirthdayWindow(birthday: string | null, now = new Date()): boolean {
  if (!birthday || !BIRTHDAY_RE.test(birthday)) return false;
  const [, m, d] = birthday.split("-").map(Number);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = 86_400_000;
  return [-1, 0, 1].some((shift) => {
    const bday = Date.UTC(now.getUTCFullYear() + shift, m - 1, d);
    return Math.abs(bday - today) <= BIRTHDAY_WINDOW_DAYS * day;
  });
}
