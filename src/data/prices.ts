// Прайс по моделях, у гривнях, «під ключ»: робота разом із деталлю.
//
// ЗВІДКИ ЧИСЛА. Прайс iPhone перебудовано в листопаді 2026: кожна ціна —
// середнє арифметичне цін конкурентів на ту саму роботу для тієї самої
// моделі, округлене до 50 ₴. Беремо 100% середнього, без знижки.
//
// Джерела (Львів): Gigistore, Reboot Service, iLounge, iCoola, AppleRoom,
// MTA-сервіс. Від кожного сервісу — одна ціна: найдешевша відповідна робота.
// Не враховано: Rosan (авторизований центр Apple, ціни у 2–4 рази вищі —
// з ним ми не конкуруємо) та iFranko (цін не публікує).
//
// АНАЛОГ І ОРИГІНАЛ. Два рівні деталі конкуренти показують лише для екрана
// й акумулятора, тож і в нас дві ціни лише там:
//   · екран: аналог — «копія»; оригінал — оригінальний модуль;
//   · акумулятор: аналог — заміна, після якої iPhone показує повідомлення
//     про невідому деталь («з помилкою»); оригінал — без повідомлення
//     («без помилки», Original IC, «з перепайкою мікросхеми»).
// Решта робіт — одна ціна: ніхто з конкурентів їх не ділить.
//
// ДЕ РИНОК НЕ ДАВ ЧИСЛА — лишено наші попередні ціни:
//   · аналог екрана там, де копію не показує жоден сервіс, а також на 16 Pro,
//     16 Pro Max і 14 — там ринкова копія (лише Reboot, IPS) виходила дешевшою
//     за старші моделі;
//   · аналог екрана 13 Pro Max — 3 000 ₴ за Reboot: у iLounge копія (13 699 ₴)
//     дорожча за їхній же оригінал, це помилка на їхньому сайті;
//   · акумулятор на 8, 8 Plus, 7, 7 Plus, 6, 6s — одна ціна: оригіналу на ці
//     моделі ніхто не пропонує; скло спинки на 7 і 7 Plus — даних немає;
//   · екран 6/6s — одна ціна: ринковий оригінал дешевший за наш аналог.
//
// ВИНЯТОК: оригінал АКБ на 16 Pro Max — 6 400 ₴, а не ринкові 5 050 ₴.
// Оригінальна деталь (донор 100%) коштує нам ~3 700 ₴, і ринкова ціна лишала
// б на роботу лише ~1 350 ₴. Робота закладена як у нашого ж аналога на цю
// модель: 3 750 ₴ мінус деталь ~1 050 ₴ = 2 700 ₴; отже 3 700 + 2 700.
//
// Два явні збої на сайті MTA відкинуто: скло спинки 16 Pro Max за 999 ₴ і
// динамік SE 3 за 7 999 ₴.
//
// iPad та Apple Watch — цін на них конкуренти не публікують, тож лишаються
// зведені з київських прайсів (AppleFix, Технарі). Їх не перевіряли.
//
// Щоб змінити ціну — правте число тут. Прибрана робота просто зникає з таблиці
// на сторінці моделі.

/**
 * Показувати ціни на сайті.
 *
 * Поставте false, щоб тимчасово сховати прайс: блок цін на сторінці послуг
 * зникне, а на сторінці моделі лишаться самі роботи без сум.
 */
export const PRICES_PUBLISHED = true;

/** Гривні */
export type Money = number;

/** Роботи, ціна яких залежить від моделі. Ключ = slug послуги з services.ts */
export const PRICED_JOBS = [
  "zamina-ekrana",
  "akumuliator",
  "roziem-zariadzhannia",
  "kamera",
  "dynamik-i-mikrofon",
  "korpus",
  "knopky-y-vibro",
] as const;

export type PricedJob = (typeof PRICED_JOBS)[number];

/** Одна сума або два рівні деталі — оригінал і якісний аналог */
export type JobPrice = Money | { analog: Money; original: Money };

export type ModelPrice = Partial<Record<PricedJob, JobPrice>>;

export const modelPrices: Record<string, ModelPrice> = {
  // ─── iPhone ───
  "iphone-16-pro-max": { "zamina-ekrana": { analog: 8550, original: 18650 }, "akumuliator": { analog: 3750, original: 6400 }, "roziem-zariadzhannia": 4350, "kamera": 6850, "dynamik-i-mikrofon": 3150, "korpus": 4850, "knopky-y-vibro": 2550 },
  "iphone-16-pro": { "zamina-ekrana": { analog: 8550, original: 17850 }, "akumuliator": { analog: 4300, original: 5050 }, "roziem-zariadzhannia": 4350, "kamera": 6600, "dynamik-i-mikrofon": 3150, "korpus": 4800, "knopky-y-vibro": 2750 },
  "iphone-16-plus": { "zamina-ekrana": { analog: 6750, original: 17350 }, "akumuliator": { analog: 3800, original: 4500 }, "roziem-zariadzhannia": 4300, "kamera": 6350, "dynamik-i-mikrofon": 3200, "korpus": 4850, "knopky-y-vibro": 2250 },
  "iphone-16": { "zamina-ekrana": { analog: 4500, original: 13900 }, "akumuliator": { analog: 3500, original: 4500 }, "roziem-zariadzhannia": 3750, "kamera": 6000, "dynamik-i-mikrofon": 3000, "korpus": 4650, "knopky-y-vibro": 2350 },
  "iphone-15-pro-max": { "zamina-ekrana": { analog: 6300, original: 17650 }, "akumuliator": { analog: 3100, original: 3800 }, "roziem-zariadzhannia": 3550, "kamera": 5900, "dynamik-i-mikrofon": 2700, "korpus": 4450, "knopky-y-vibro": 1600 },
  "iphone-15-pro": { "zamina-ekrana": { analog: 5600, original: 15600 }, "akumuliator": { analog: 3000, original: 3750 }, "roziem-zariadzhannia": 3550, "kamera": 5850, "dynamik-i-mikrofon": 2650, "korpus": 4350, "knopky-y-vibro": 1600 },
  "iphone-15-plus": { "zamina-ekrana": { analog: 2900, original: 11600 }, "akumuliator": { analog: 3050, original: 3700 }, "roziem-zariadzhannia": 3550, "kamera": 5700, "dynamik-i-mikrofon": 2400, "korpus": 3800, "knopky-y-vibro": 1700 },
  "iphone-15": { "zamina-ekrana": { analog: 4800, original: 10600 }, "akumuliator": { analog: 2900, original: 3500 }, "roziem-zariadzhannia": 3400, "kamera": 5650, "dynamik-i-mikrofon": 2550, "korpus": 3700, "knopky-y-vibro": 1600 },
  "iphone-14-pro-max": { "zamina-ekrana": { analog: 2500, original: 14200 }, "akumuliator": { analog: 2800, original: 3600 }, "roziem-zariadzhannia": 3100, "kamera": 5400, "dynamik-i-mikrofon": 2450, "korpus": 4050, "knopky-y-vibro": 1550 },
  "iphone-14-pro": { "zamina-ekrana": { analog: 2600, original: 12050 }, "akumuliator": { analog: 2700, original: 3500 }, "roziem-zariadzhannia": 3250, "kamera": 4950, "dynamik-i-mikrofon": 2450, "korpus": 3750, "knopky-y-vibro": 1550 },
  "iphone-14-plus": { "zamina-ekrana": { analog: 2900, original: 9250 }, "akumuliator": { analog: 2750, original: 3350 }, "roziem-zariadzhannia": 3250, "kamera": 5000, "dynamik-i-mikrofon": 2450, "korpus": 3000, "knopky-y-vibro": 1500 },
  "iphone-14": { "zamina-ekrana": { analog: 2550, original: 6800 }, "akumuliator": { analog: 2550, original: 3350 }, "roziem-zariadzhannia": 2950, "kamera": 5000, "dynamik-i-mikrofon": 2400, "korpus": 2700, "knopky-y-vibro": 1550 },
  "iphone-13-pro-max": { "zamina-ekrana": { analog: 3000, original: 9600 }, "akumuliator": { analog: 2300, original: 2700 }, "roziem-zariadzhannia": 2000, "kamera": 5000, "dynamik-i-mikrofon": 1500, "korpus": 2750, "knopky-y-vibro": 1200 },
  "iphone-13-pro": { "zamina-ekrana": { analog: 3350, original: 8250 }, "akumuliator": { analog: 2300, original: 2650 }, "roziem-zariadzhannia": 1950, "kamera": 4950, "dynamik-i-mikrofon": 1550, "korpus": 2700, "knopky-y-vibro": 1200 },
  "iphone-13": { "zamina-ekrana": { analog: 2500, original: 5800 }, "akumuliator": { analog: 2150, original: 2450 }, "roziem-zariadzhannia": 1900, "kamera": 4350, "dynamik-i-mikrofon": 1150, "korpus": 2300, "knopky-y-vibro": 1200 },
  "iphone-13-mini": { "zamina-ekrana": { analog: 3550, original: 5550 }, "akumuliator": { analog: 2100, original: 2700 }, "roziem-zariadzhannia": 1900, "kamera": 3950, "dynamik-i-mikrofon": 1250, "korpus": 2250, "knopky-y-vibro": 1200 },
  "iphone-12-pro-max": { "zamina-ekrana": { analog: 2500, original: 6850 }, "akumuliator": { analog: 1900, original: 2350 }, "roziem-zariadzhannia": 1950, "kamera": 3750, "dynamik-i-mikrofon": 1100, "korpus": 2300, "knopky-y-vibro": 1050 },
  "iphone-12-pro": { "zamina-ekrana": { analog: 2100, original: 4900 }, "akumuliator": { analog: 1700, original: 2350 }, "roziem-zariadzhannia": 1950, "kamera": 3850, "dynamik-i-mikrofon": 1100, "korpus": 2100, "knopky-y-vibro": 1000 },
  "iphone-12": { "zamina-ekrana": { analog: 2100, original: 4900 }, "akumuliator": { analog: 1700, original: 2250 }, "roziem-zariadzhannia": 1850, "kamera": 3150, "dynamik-i-mikrofon": 1050, "korpus": 2000, "knopky-y-vibro": 1000 },
  "iphone-12-mini": { "zamina-ekrana": { analog: 2900, original: 5000 }, "akumuliator": { analog: 1750, original: 2300 }, "roziem-zariadzhannia": 2050, "kamera": 2950, "dynamik-i-mikrofon": 1050, "korpus": 2150, "knopky-y-vibro": 1050 },
  "iphone-11-pro-max": { "zamina-ekrana": { analog: 3100, original: 4500 }, "akumuliator": { analog: 1650, original: 2150 }, "roziem-zariadzhannia": 2450, "kamera": 3200, "dynamik-i-mikrofon": 900, "korpus": 1900, "knopky-y-vibro": 1050 },
  "iphone-11-pro": { "zamina-ekrana": { analog: 2750, original: 3900 }, "akumuliator": { analog: 1650, original: 2200 }, "roziem-zariadzhannia": 2200, "kamera": 2950, "dynamik-i-mikrofon": 900, "korpus": 1700, "knopky-y-vibro": 1050 },
  "iphone-11": { "zamina-ekrana": { analog: 2050, original: 2750 }, "akumuliator": { analog: 1450, original: 2100 }, "roziem-zariadzhannia": 1500, "kamera": 2250, "dynamik-i-mikrofon": 800, "korpus": 1550, "knopky-y-vibro": 900 },
  "iphone-xs-max": { "zamina-ekrana": { analog: 3100, original: 4450 }, "akumuliator": { analog: 1450, original: 1850 }, "roziem-zariadzhannia": 1450, "kamera": 2550, "dynamik-i-mikrofon": 800, "korpus": 1700, "knopky-y-vibro": 750 },
  "iphone-xs": { "zamina-ekrana": { analog: 1400, original: 3400 }, "akumuliator": { analog: 1350, original: 1800 }, "roziem-zariadzhannia": 1400, "kamera": 2350, "dynamik-i-mikrofon": 800, "korpus": 1550, "knopky-y-vibro": 750 },
  "iphone-xr": { "zamina-ekrana": { analog: 2100, original: 2850 }, "akumuliator": { analog: 1350, original: 1650 }, "roziem-zariadzhannia": 1350, "kamera": 1600, "dynamik-i-mikrofon": 750, "korpus": 1500, "knopky-y-vibro": 750 },
  "iphone-x": { "zamina-ekrana": { analog: 2200, original: 3000 }, "akumuliator": { analog: 1200, original: 1800 }, "roziem-zariadzhannia": 1200, "kamera": 1600, "dynamik-i-mikrofon": 750, "korpus": 1250, "knopky-y-vibro": 700 },
  "iphone-8-plus": { "zamina-ekrana": { analog: 1350, original: 2150 }, "akumuliator": 750, "roziem-zariadzhannia": 800, "kamera": 2200, "dynamik-i-mikrofon": 600, "korpus": 800, "knopky-y-vibro": 650 },
  "iphone-8": { "zamina-ekrana": { analog: 1200, original: 1950 }, "akumuliator": 700, "roziem-zariadzhannia": 1000, "kamera": 1550, "dynamik-i-mikrofon": 600, "korpus": 800, "knopky-y-vibro": 650 },
  "iphone-7-plus": { "zamina-ekrana": { analog: 1300, original: 2000 }, "akumuliator": 900, "roziem-zariadzhannia": 1000, "kamera": 2200, "dynamik-i-mikrofon": 550, "korpus": 950, "knopky-y-vibro": 550 },
  "iphone-7": { "zamina-ekrana": { analog: 1000, original: 1700 }, "akumuliator": 700, "roziem-zariadzhannia": 700, "kamera": 1100, "dynamik-i-mikrofon": 600, "korpus": 950, "knopky-y-vibro": 650 },
  "iphone-se-3": { "zamina-ekrana": { analog: 1000, original: 2500 }, "akumuliator": { analog: 1400, original: 1750 }, "roziem-zariadzhannia": 1050, "kamera": 2250, "dynamik-i-mikrofon": 700, "korpus": 1500, "knopky-y-vibro": 750 },
  "iphone-se-2": { "zamina-ekrana": { analog: 950, original: 2250 }, "akumuliator": { analog: 1000, original: 1350 }, "roziem-zariadzhannia": 1200, "kamera": 2150, "dynamik-i-mikrofon": 700, "korpus": 1500, "knopky-y-vibro": 650 },
  "iphone-6s-6s-plus": { "zamina-ekrana": 1300, "akumuliator": 500, "roziem-zariadzhannia": 500, "kamera": 500, "dynamik-i-mikrofon": 400, "korpus": 900, "knopky-y-vibro": 400 },
  "iphone-6-6-plus": { "zamina-ekrana": 1200, "akumuliator": 550, "roziem-zariadzhannia": 450, "kamera": 550, "dynamik-i-mikrofon": 400, "korpus": 880, "knopky-y-vibro": 400 },

  // ─── iPad ───
  "ipad-pro-13-m4": { "zamina-ekrana": 13400, "akumuliator": 3800, "roziem-zariadzhannia": 1900 },
  "ipad-pro-11-m1": { "zamina-ekrana": 6400, "akumuliator": 3300, "roziem-zariadzhannia": 1700 },
  "ipad-pro-11-2020": { "zamina-ekrana": 5600, "akumuliator": 2800, "roziem-zariadzhannia": 1600 },
  "ipad-pro-11-2018": { "zamina-ekrana": 5200, "akumuliator": 2600, "roziem-zariadzhannia": 1600 },
  "ipad-pro-12-9-2020": { "zamina-ekrana": 9500, "akumuliator": 3200, "roziem-zariadzhannia": 1700 },
  "ipad-pro-12-9-2018": { "zamina-ekrana": 7600, "akumuliator": 2900, "roziem-zariadzhannia": 1600 },
  "ipad-pro-12-9-2017": { "zamina-ekrana": 5000, "akumuliator": 2300, "roziem-zariadzhannia": 1500 },
  "ipad-pro-12-9-2015": { "zamina-ekrana": 4400, "akumuliator": 2100, "roziem-zariadzhannia": 1400 },
  "ipad-pro-10-5": { "zamina-ekrana": 3600, "akumuliator": 1600, "roziem-zariadzhannia": 1400 },
  "ipad-pro-9-7": { "zamina-ekrana": 3100, "akumuliator": 1700, "roziem-zariadzhannia": 1300 },
  "ipad-air-5": { "zamina-ekrana": 3200, "akumuliator": 2500, "roziem-zariadzhannia": 1500 },
  "ipad-air-4": { "zamina-ekrana": 2900, "akumuliator": 2400, "roziem-zariadzhannia": 1400 },
  "ipad-air-3": { "zamina-ekrana": 2400, "akumuliator": 2300, "roziem-zariadzhannia": 1300 },
  "ipad-10": { "zamina-ekrana": 2600, "akumuliator": 1800, "roziem-zariadzhannia": 1400 },
  "ipad-9": { "zamina-ekrana": 1900, "akumuliator": 1600, "roziem-zariadzhannia": 1200 },
  "ipad-8": { "zamina-ekrana": 1800, "akumuliator": 1500, "roziem-zariadzhannia": 1200 },
  "ipad-7": { "zamina-ekrana": 1700, "akumuliator": 1500, "roziem-zariadzhannia": 1200 },
  "ipad-6": { "zamina-ekrana": 1500, "akumuliator": 1400, "roziem-zariadzhannia": 1100 },
  "ipad-5": { "zamina-ekrana": 1400, "akumuliator": 1400, "roziem-zariadzhannia": 1100 },
  "ipad-mini-6": { "zamina-ekrana": 3400, "akumuliator": 2000, "roziem-zariadzhannia": 1500 },
  "ipad-mini-5": { "zamina-ekrana": 2500, "akumuliator": 1700, "roziem-zariadzhannia": 1300 },
  "ipad-mini-4": { "zamina-ekrana": 2300, "akumuliator": 1500, "roziem-zariadzhannia": 1200 },

  // ─── Apple Watch ───
  "apple-watch-ultra": { "zamina-ekrana": 6200, "akumuliator": 2800 },
  "apple-watch-s9": { "zamina-ekrana": 3000, "akumuliator": 2300 },
  "apple-watch-s8": { "zamina-ekrana": 2800, "akumuliator": 2100 },
  "apple-watch-se": { "zamina-ekrana": 2000, "akumuliator": 1500 },
  "apple-watch-s7": { "zamina-ekrana": 2600, "akumuliator": 1900 },
  "apple-watch-s5": { "zamina-ekrana": 1800, "akumuliator": 1400 },
  "apple-watch-s4": { "zamina-ekrana": 1700, "akumuliator": 1300 },
  "apple-watch-s3": { "zamina-ekrana": 1300, "akumuliator": 1000 },
  "apple-watch-s2": { "zamina-ekrana": 1200, "akumuliator": 950 },
  "apple-watch-s1": { "zamina-ekrana": 1100, "akumuliator": 900 },
};

/**
 * Роботи на платі: ціна залежить від того, що покаже діагностика, а не від
 * моделі. Тому показуємо «від» — і лише після безкоштовної діагностики
 * називаємо точну суму.
 */
export const boardPrices: { slug: string; from: Money }[] = [
  { slug: "zalyv-vodoiu", from: 600 },
  { slug: "ne-vmykaietsia", from: 500 },
  { slug: "ne-bachyt-merezhu", from: 1990 },
  { slug: "vidnovlennia-danykh", from: 600 },
];

/** Фіксовані ціни, однакові для всіх моделей */
export const flatPrices: { slug: string; price: Money }[] = [
  { slug: "profilaktyka", price: 600 },
];

export function getModelPrice(slug: string): ModelPrice | undefined {
  return modelPrices[slug];
}

/**
 * Вилка ціни роботи по всьому каталогу — зведена таблиця на сторінці послуг.
 * only — slug-и моделей, якщо вилка потрібна лише по частині каталогу (самі iPhone).
 */
export function jobRange(job: PricedJob, only?: readonly string[]): { min: Money; max: Money } | null {
  const all: Money[] = [];

  for (const [slug, price] of Object.entries(modelPrices)) {
    if (only && !only.includes(slug)) continue;
    const v = price[job];
    if (v === undefined) continue;
    if (typeof v === "number") all.push(v);
    else all.push(v.analog, v.original);
  }

  if (all.length === 0) return null;
  return { min: Math.min(...all), max: Math.max(...all) };
}

/**
 * Від скількох починається послуга — для картки в каталозі.
 *
 * У робіт, що залежать від моделі, це найдешевша модель у прайсі; у решти —
 * фіксована ціна. Послуга без ціни повертає null: у картці лишиться номер.
 */
export function serviceFrom(slug: string): { price: Money; exact: boolean } | null {
  if ((PRICED_JOBS as readonly string[]).includes(slug)) {
    const min = jobRange(slug as PricedJob)?.min;
    return min === undefined ? null : { price: min, exact: false };
  }

  const board = boardPrices.find((b) => b.slug === slug);
  if (board) return { price: board.from, exact: false };

  // Профілактика коштує однаково для всіх — «від» тут було б неправдою
  const flat = flatPrices.find((f) => f.slug === slug);
  return flat ? { price: flat.price, exact: true } : null;
}

/** 3400 → «3 400 ₴» — нерозривний пробіл, щоб сума не ламалась на два рядки */
export function uah(value: Money): string {
  return `${value.toLocaleString("uk-UA").replace(/\s/g, "\u202f")}\u202f₴`;
}
