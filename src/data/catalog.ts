// Єдина точка входу в каталог: розділи, пошук моделі за slug, сусідні моделі.

import { ipads, watches } from "./devices";
import { iphones, type DeviceKind, type Model } from "./models";

export type Section = {
  kind: DeviceKind;
  /** Адреса розділу */
  href: string;
  /** Коротка назва для вкладок */
  tab: string;
  title: string;
  lead: string;
  models: Model[];
};

export const sections: Section[] = [
  {
    kind: "iphone",
    href: "/modeli",
    tab: "iPhone",
    title: "Ремонт iPhone за моделями",
    lead: "Натисніть на свою модель — відкриється сторінка з роботами, цінами й термінами.",
    models: iphones,
  },
  {
    kind: "ipad",
    href: "/planshety",
    tab: "iPad",
    title: "Ремонт планшетів iPad",
    lead: "Скло, акумулятор, роз'єм заряджання. Розбираємо з підігрівом, щоб не пошкодити рамку.",
    models: ipads,
  },
  {
    kind: "watch",
    href: "/godynnyky",
    tab: "Apple Watch",
    title: "Ремонт Apple Watch",
    lead: "Заміна скла й акумулятора, відновлення герметизації після ремонту.",
    models: watches,
  },
];

export const allModels: Model[] = [...iphones, ...ipads, ...watches];

export function getSection(kind: DeviceKind): Section {
  const found = sections.find((s) => s.kind === kind);
  if (!found) throw new Error(`Немає розділу каталогу: ${kind}`);
  return found;
}

export function getModel(slug: string): Model | undefined {
  return allModels.find((m) => m.slug === slug);
}

/** Розділ, до якого належить модель — для хлібних крихт */
export function sectionOf(slug: string): Section {
  return sections.find((s) => s.models.some((m) => m.slug === slug)) ?? sections[0];
}

/** Дві сусідні моделі того ж розділу — блок «пов'язані» на сторінці моделі */
export function relatedTo(slug: string): Model[] {
  const section = sectionOf(slug);
  const i = section.models.findIndex((m) => m.slug === slug);
  if (i < 0) return section.models.slice(0, 2);

  return [
    section.models[(i + 1) % section.models.length],
    section.models[(i + 2) % section.models.length],
  ];
}
