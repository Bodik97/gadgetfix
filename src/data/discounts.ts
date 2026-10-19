/**
 * Знижки клієнта: 5% за реєстрацію — на перший ремонт, 10% за схвалений відгук
 * із фото — на наступний. На одну заявку діє одна знижка.
 */
export const DISCOUNT_PERCENT = { signup: 5, review: 10 } as const;

export type DiscountKind = keyof typeof DISCOUNT_PERCENT;

/** За що знижка — для підписів: «−5% за реєстрацію» */
export const DISCOUNT_REASON: Record<DiscountKind, string> = {
  signup: "за реєстрацію",
  review: "за відгук",
};
