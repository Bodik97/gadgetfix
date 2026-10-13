import type { Metadata } from "next";
import CatalogSection from "@/components/CatalogSection";
import { getSection } from "@/data/catalog";
import { site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";

const section = getSection("ipad");

export const metadata: Metadata = {
  title: `Ремонт iPad ${site.citiesIn} — ціни`,
  description: `Ремонт iPad ${site.citiesIn}: ціни на заміну скла, акумулятора та роз'єму заряджання для ${section.models.length} моделей. Безкоштовна діагностика, фіксована ціна, гарантія ${WARRANTY_MAX}.`,
  alternates: { canonical: "/planshety" },
};

export default function TabletsPage() {
  return <CatalogSection section={section} />;
}
