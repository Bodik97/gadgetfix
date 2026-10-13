import type { Metadata } from "next";
import CatalogSection from "@/components/CatalogSection";
import { getSection } from "@/data/catalog";
import { site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";

const section = getSection("watch");

export const metadata: Metadata = {
  title: `Ремонт Apple Watch ${site.citiesIn}`,
  description: `Ремонт Apple Watch ${site.citiesIn}: ціни на заміну скла й акумулятора для ${section.models.length} моделей, відновлення герметизації. Гарантія ${WARRANTY_MAX} на роботу й деталь.`,
  alternates: { canonical: "/godynnyky" },
};

export default function WatchesPage() {
  return <CatalogSection section={section} />;
}
