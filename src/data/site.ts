export const site = {
  name: "GadgetFix",
  tagline: "Ремонт iPhone, iPad, Apple Watch та Android-смартфонів у Львові й Новому Роздолі.",
  phones: [
    { label: "063 116 43 77", href: "tel:+380631164377" },
    { label: "073 315 02 38", href: "tel:+380733150238" },
  ],
  hours: "Пн–Сб 8:00–18:00",
  hoursNote: "Нд за домовленістю",
  cities: ["Львів", "Новий Розділ"],
  /** Ті самі міста в місцевому відмінку — для заголовків і описів сторінок */
  citiesIn: "у Львові та Новому Роздолі",
  messengers: [
    { label: "Viber", href: "viber://chat?number=%2B380631164377" },
  ],
} as const;

/** Якір вузла LocalBusiness у JSON-LD: сторінки посилаються на нього через @id */
export const BUSINESS_ID = "/#business";

export const nav = [
  { href: "/", label: "Головна" },
  { href: "/poslugy", label: "Послуги" },
  { href: "/modeli", label: "iPhone" },
  { href: "/android", label: "Android" },
  { href: "/poshtoyu", label: "Поштою" },
] as const;
