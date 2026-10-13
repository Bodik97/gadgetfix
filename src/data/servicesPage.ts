// Контент сторінки /poslugy — перенесено з design/GadgetFix-Services.dc.html

import { services } from "./services";

/** Коротка назва для стрічки + іконка з картки тієї ж послуги */
const ticker: [slug: string, label: string][] = [
  ["zamina-ekrana", "Екран"],
  ["akumuliator", "Акумулятор"],
  ["roziem-zariadzhannia", "Роз'єм заряджання"],
  ["kamera", "Камера"],
  ["zalyv-vodoiu", "Залив водою"],
  ["ne-vmykaietsia", "Не вмикається"],
  ["dynamik-i-mikrofon", "Динамік і мікрофон"],
  ["korpus", "Корпус"],
];

export const tickerItems = ticker.map(([slug, label]) => ({
  label,
  icon: services.find((s) => s.slug === slug)?.icon,
}));

export const flow = [
  { no: "01", title: "Заявка", body: "Телефон, форма або Viber. Питаємо модель і симптом — одразу даємо орієнтир." },
  { no: "02", title: "Діагностика", body: "Безкоштовна. Показуємо, що саме зламано." },
  { no: "03", title: "Фіксована ціна", body: "Називаємо суму до початку робіт. На ходу вона не змінюється." },
  { no: "04", title: "Передоплата за деталь", body: "Погодили ціну — вносите передоплату за запчастину. Решта при видачі." },
  { no: "05", title: "Ремонт і перевірка", body: "Тестуємо разом із вами перед видачею. Гарантія 2 місяці на аналог, 4 місяці на оригінал." },
];

export const promises = [
  { value: "0 ₴", note: "діагностика" },
  { value: "до 4 міс.", note: "гарантія: 2 міс. на аналог, 4 — на оригінал" },
  { value: "до 2 днів", note: "на деталь і заміну екрана чи акумулятора; доставка — окремо" },
  { value: "25 хв", note: "відповідаємо на заявку в робочі години" },
];
