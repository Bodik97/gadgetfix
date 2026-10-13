// Прайс по моделях, у гривнях, «під ключ»: робота разом із деталлю.
//
// ЗВІДКИ ЧИСЛА. Прайс повністю перебудовано за реальними цінами конкурентів,
// зібраними у вересні 2026. Кожну модель перевіряли окремо, а не множили
// на коефіцієнт.
//
// Кошик джерел підібрано так, щоб моделі лишались порівнянними між собою:
//
//   · iPhone X і новіші (27 моделей) — kiviparts.com.ua (Львів). Це єдиний
//     сервіс із повним і внутрішньо узгодженим прайсом на всі роботи по всіх
//     моделях. Брати для одних моделей середнє з чотирьох джерел, а для інших
//     з одного, не можна: базова версія виходила дорожчою за Pro лише тому,
//     що в її вибірці був преміальний сервіс.
//
//   · iPhone 6 — 8 Plus (6 моделей) — середнє з icoola.ua, reboot-service.com.ua
//     та ilounge.ua. KIVI цих моделей уже не обслуговує.
//
// ВИНЯТОК, зроблений свідомо: акумулятор на 7 і 7 Plus коштує 900 ₴, хоч
// ринкове середнє 800 ₴. Деталь обходиться нам у 450 ₴, і 800 ₴ лишали б
// 350 ₴ на роботу, доставку й прибуток разом. Середнє тут тягне вниз Reboot
// Service (690 ₴) — у них інша закупівля, і копіювати їхню ціну означає
// копіювати чужу собівартість.
//
// ЩЕ ОДНА ПРАВКА: роз'єм заряджання на 11 Pro і 11 Pro Max. У джерела там
// 1 751 ₴ — утричі більше за базову 11-ку (584 ₴) і вдвічі за 12 Pro (853 ₴).
// Це схоже на їхню помилку, а не на ринок, тож поставлено 700 і 750 ₴ за
// сусідами. Знайшов автоматичний тест цілісності прайсу.
//
// ЗГЛАДЖЕНО 6 позицій, де джерело суперечило саме собі (Pro виходив дешевшим
// за базову модель того ж покоління):
//   16 Pro акумулятор, 15 Pro і 15 Pro Max динамік, 13 Pro і 13 Pro Max копія
//   екрана, 14 Pro Max акумулятор.
//
// Ряди перевірено: у межах лінійки (база / Pro / Pro Max) старша модель ніде
// не дорожча за новішу.
//
// НЕ ПЕРЕВІРЕНО: iPhone SE 2 і SE 3 — цих моделей немає в прайсі жодного
// з чотирьох сервісів. Їхні ціни лишаються оцінкою за сусідніми моделями.
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
  "iphone-16-pro-max": { "zamina-ekrana": { analog: 8550, original: 15700 }, "akumuliator": 2900, "roziem-zariadzhannia": 3800, "kamera": 3800, "dynamik-i-mikrofon": 2000, "korpus": 2800, "knopky-y-vibro": 1100 },
  "iphone-16-pro": { "zamina-ekrana": { analog: 8550, original: 13450 }, "akumuliator": 2900, "roziem-zariadzhannia": 3800, "kamera": 3800, "dynamik-i-mikrofon": 1800, "korpus": 2800, "knopky-y-vibro": 1100 },
  "iphone-16-plus": { "zamina-ekrana": { analog: 6750, original: 9000 }, "akumuliator": 2900, "roziem-zariadzhannia": 3800, "kamera": 3300, "dynamik-i-mikrofon": 1550, "korpus": 2300, "knopky-y-vibro": 1000 },
  "iphone-16": { "zamina-ekrana": { analog: 6750, original: 9000 }, "akumuliator": 2900, "roziem-zariadzhannia": 3600, "kamera": 3300, "dynamik-i-mikrofon": 1350, "korpus": 2300, "knopky-y-vibro": 1000 },
  "iphone-15-pro-max": { "zamina-ekrana": { analog: 6300, original: 16000 }, "akumuliator": 2600, "roziem-zariadzhannia": 2350, "kamera": 4950, "dynamik-i-mikrofon": 950, "korpus": 3500, "knopky-y-vibro": 1000 },
  "iphone-15-pro": { "zamina-ekrana": { analog: 5600, original: 14000 }, "akumuliator": 2400, "roziem-zariadzhannia": 2050, "kamera": 4950, "dynamik-i-mikrofon": 950, "korpus": 2800, "knopky-y-vibro": 1000 },
  "iphone-15-plus": { "zamina-ekrana": { analog: 2900, original: 9700 }, "akumuliator": 2300, "roziem-zariadzhannia": 3850, "kamera": 3050, "dynamik-i-mikrofon": 1200, "korpus": 2300, "knopky-y-vibro": 950 },
  "iphone-15": { "zamina-ekrana": { analog: 4800, original: 8700 }, "akumuliator": 2200, "roziem-zariadzhannia": 1900, "kamera": 3000, "dynamik-i-mikrofon": 950, "korpus": 2300, "knopky-y-vibro": 950 },
  "iphone-14-pro-max": { "zamina-ekrana": { analog: 3000, original: 14000 }, "akumuliator": 2300, "roziem-zariadzhannia": 1550, "kamera": 4950, "dynamik-i-mikrofon": 1000, "korpus": 2100, "knopky-y-vibro": 950 },
  "iphone-14-pro": { "zamina-ekrana": { analog: 3800, original: 12000 }, "akumuliator": 2200, "roziem-zariadzhannia": 1450, "kamera": 4500, "dynamik-i-mikrofon": 700, "korpus": 2100, "knopky-y-vibro": 950 },
  "iphone-14-plus": { "zamina-ekrana": { analog: 2900, original: 9200 }, "akumuliator": 2200, "roziem-zariadzhannia": 1300, "kamera": 2600, "dynamik-i-mikrofon": 700, "korpus": 2100, "knopky-y-vibro": 900 },
  "iphone-14": { "zamina-ekrana": { analog: 2550, original: 7700 }, "akumuliator": 2000, "roziem-zariadzhannia": 1200, "kamera": 3000, "dynamik-i-mikrofon": 700, "korpus": 1850, "knopky-y-vibro": 900 },
  "iphone-13-pro-max": { "zamina-ekrana": { analog: 3350, original: 10500 }, "akumuliator": 1800, "roziem-zariadzhannia": 1550, "kamera": 4500, "dynamik-i-mikrofon": 750, "korpus": 2000, "knopky-y-vibro": 900 },
  "iphone-13-pro": { "zamina-ekrana": { analog: 3350, original: 8700 }, "akumuliator": 1850, "roziem-zariadzhannia": 1450, "kamera": 4500, "dynamik-i-mikrofon": 750, "korpus": 2000, "knopky-y-vibro": 900 },
  "iphone-13": { "zamina-ekrana": { analog: 3350, original: 6000 }, "akumuliator": 1650, "roziem-zariadzhannia": 1150, "kamera": 2700, "dynamik-i-mikrofon": 750, "korpus": 2000, "knopky-y-vibro": 850 },
  "iphone-13-mini": { "zamina-ekrana": { analog: 3550, original: 4800 }, "akumuliator": 1600, "roziem-zariadzhannia": 1150, "kamera": 2700, "dynamik-i-mikrofon": 800, "korpus": 1900, "knopky-y-vibro": 850 },
  "iphone-12-pro-max": { "zamina-ekrana": { analog: 3350, original: 7000 }, "akumuliator": 1600, "roziem-zariadzhannia": 1100, "kamera": 4700, "dynamik-i-mikrofon": 650, "korpus": 1800, "knopky-y-vibro": 850 },
  "iphone-12-pro": { "zamina-ekrana": { analog: 2450, original: 4700 }, "akumuliator": 1400, "roziem-zariadzhannia": 850, "kamera": 5400, "dynamik-i-mikrofon": 650, "korpus": 1600, "knopky-y-vibro": 800 },
  "iphone-12": { "zamina-ekrana": { analog: 2450, original: 4200 }, "akumuliator": 1400, "roziem-zariadzhannia": 850, "kamera": 2900, "dynamik-i-mikrofon": 650, "korpus": 1500, "knopky-y-vibro": 800 },
  "iphone-12-mini": { "zamina-ekrana": { analog: 2900, original: 4300 }, "akumuliator": 1400, "roziem-zariadzhannia": 1150, "kamera": 2900, "dynamik-i-mikrofon": 650, "korpus": 1450, "knopky-y-vibro": 800 },
  "iphone-11-pro-max": { "zamina-ekrana": { analog: 2250, original: 4600 }, "akumuliator": 1350, "roziem-zariadzhannia": 750, "kamera": 2700, "dynamik-i-mikrofon": 650, "korpus": 1300, "knopky-y-vibro": 800 },
  "iphone-11-pro": { "zamina-ekrana": { analog: 1800, original: 3900 }, "akumuliator": 1300, "roziem-zariadzhannia": 700, "kamera": 2700, "dynamik-i-mikrofon": 650, "korpus": 1200, "knopky-y-vibro": 800 },
  "iphone-11": { "zamina-ekrana": { analog: 1000, original: 3000 }, "akumuliator": 1250, "roziem-zariadzhannia": 600, "kamera": 1350, "dynamik-i-mikrofon": 600, "korpus": 1099, "knopky-y-vibro": 750 },
  "iphone-xs-max": { "zamina-ekrana": { analog: 2000, original: 4000 }, "akumuliator": 1150, "roziem-zariadzhannia": 650, "kamera": 1900, "dynamik-i-mikrofon": 600, "korpus": 1100, "knopky-y-vibro": 750 },
  "iphone-xs": { "zamina-ekrana": { analog: 1750, original: 3800 }, "akumuliator": 1050, "roziem-zariadzhannia": 600, "kamera": 1900, "dynamik-i-mikrofon": 600, "korpus": 999, "knopky-y-vibro": 700 },
  "iphone-xr": { "zamina-ekrana": { analog: 1000, original: 2400 }, "akumuliator": 1100, "roziem-zariadzhannia": 550, "kamera": 1300, "dynamik-i-mikrofon": 600, "korpus": 999, "knopky-y-vibro": 700 },
  "iphone-x": { "zamina-ekrana": { analog: 1650, original: 3500 }, "akumuliator": 650, "roziem-zariadzhannia": 550, "kamera": 1100, "dynamik-i-mikrofon": 600, "korpus": 899, "knopky-y-vibro": 700 },
  "iphone-8-plus": { "zamina-ekrana": { analog: 1200, original: 2200 }, "akumuliator": 900, "roziem-zariadzhannia": 750, "kamera": 2200, "dynamik-i-mikrofon": 600, "korpus": 999, "knopky-y-vibro": 650 },
  "iphone-8": { "zamina-ekrana": { analog: 850, original: 2000 }, "akumuliator": 900, "roziem-zariadzhannia": 1300, "kamera": 1400, "dynamik-i-mikrofon": 600, "korpus": 950, "knopky-y-vibro": 620 },
  "iphone-7-plus": { "zamina-ekrana": { analog: 900, original: 1900 }, "akumuliator": 900, "roziem-zariadzhannia": 550, "kamera": 1550, "dynamik-i-mikrofon": 600, "korpus": 950, "knopky-y-vibro": 650 },
  "iphone-7": { "zamina-ekrana": { analog: 900, original: 1850 }, "akumuliator": 900, "roziem-zariadzhannia": 550, "kamera": 900, "dynamik-i-mikrofon": 600, "korpus": 950, "knopky-y-vibro": 650 },
  "iphone-se-3": { "zamina-ekrana": { analog: 1000, original: 1850 }, "akumuliator": 1000, "roziem-zariadzhannia": 600, "kamera": 680, "dynamik-i-mikrofon": 480, "korpus": 950, "knopky-y-vibro": 630 },
  "iphone-se-2": { "zamina-ekrana": { analog: 950, original: 1800 }, "akumuliator": 900, "roziem-zariadzhannia": 580, "kamera": 650, "dynamik-i-mikrofon": 480, "korpus": 950, "knopky-y-vibro": 620 },
  "iphone-6s-6s-plus": { "zamina-ekrana": { analog: 1450, original: 1500 }, "akumuliator": 500, "roziem-zariadzhannia": 500, "kamera": 560, "dynamik-i-mikrofon": 300, "korpus": 900, "knopky-y-vibro": 600 },
  "iphone-6-6-plus": { "zamina-ekrana": { analog: 1300, original: 1400 }, "akumuliator": 550, "roziem-zariadzhannia": 450, "kamera": 550, "dynamik-i-mikrofon": 300, "korpus": 880, "knopky-y-vibro": 600 },

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
