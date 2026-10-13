import type { Metadata } from "next";
import CatalogSection from "@/components/CatalogSection";
import { getSection } from "@/data/catalog";
import { site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";

const section = getSection("iphone");

export const metadata: Metadata = {
  title: { absolute: `Ремонт iPhone за моделями ${site.citiesIn} — ціни` },
  description: `Ремонт iPhone ${site.citiesIn}: ціни на заміну екрана, акумулятора, роз'єму й камери для ${section.models.length} моделей. Діагностика безкоштовна, гарантія ${WARRANTY_MAX}.`,
  alternates: { canonical: "/modeli" },
};

export default function CatalogPage() {
  return <CatalogSection section={section} />;
}
