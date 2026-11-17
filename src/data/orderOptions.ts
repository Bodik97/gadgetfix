/**
 * Чипи в картці заявки (docs/admin-handoff/design/Order.dc.html).
 * Список закритий: сервер приймає лише ці значення.
 */
export const PROBLEMS = [
  "Не заряджається",
  "Екран",
  "Батарея",
  "Кришка",
  "Камера",
  "Після води",
  "Не вмикається",
  "Звук",
  "Інше",
] as const;

export const CONDITION = ["Без пошкоджень", "Подряпини", "Тріщина", "Вмʼятини", "Сліди вологи"] as const;

export const KIT = ["Лише телефон", "Чохол", "Скло", "Зарядка", "Коробка", "SIM-карта"] as const;

/** Перевірка перед видачею — усі пункти обовʼязкові */
export const CHECKS = ["Зарядка", "Екран", "Face ID / Touch ID", "Камери", "Звук", "Мережа"] as const;

export const PAYMENT_LABEL = { cash: "Готівка", card: "Картка", transfer: "Переказ" } as const;

export const PHOTO_SLOTS = [
  { slot: "front", label: "Спереду" },
  { slot: "back", label: "Ззаду" },
  { slot: "frame", label: "Рамка" },
] as const;

/** Підказка терміну: деталь є — завтра, треба замовляти — через 3 дні (вихідні не рахуємо) */
export const DUE_HINTS = [
  { days: 1, label: "Завтра · деталь є" },
  { days: 3, label: "+3 дні · замовити деталь" },
] as const;

/** Причина паузи — обовʼязкова: на дошці видно, на що чекаємо */
export const PAUSE_REASONS = ["чекаємо деталь", "чекаємо клієнта", "чекаємо оплату"] as const;

/** Магазин «Онлайн» дає своїм клієнтам місяць гарантії — стільки ж і ми йому */
export const ONLINE_WARRANTY_DAYS = 30;
