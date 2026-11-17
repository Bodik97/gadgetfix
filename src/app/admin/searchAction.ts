"use server";

import { redirect } from "next/navigation";
import { getBoardLeads, getPartnerPrices } from "@/db/board";
import { currentAdmin } from "@/lib/admin";
import { searchPrices, type PriceHit } from "@/lib/priceSearch";
import { orderLabel, STAGE_LABEL } from "@/lib/stage";

export type OrderHit = { id: string; label: string; who: string; what: string; stage: string };
export type SearchResult = { orders: OrderHit[]; prices: PriceHit[] };

/**
 * Швидкий пошук (Ctrl+K): заявки за №, О-…, імʼям, телефоном, IMEI, моделлю —
 * разом із виданими; і роботи з цінами — наш прайс і прайс магазину.
 */
export async function quickSearch(q: string): Promise<SearchResult> {
  if (!(await currentAdmin())) redirect("/admin/vhid");

  const text = q.trim().slice(0, 80);
  if (text.length < 2) return { orders: [], prices: [] };

  const [leads, partner] = await Promise.all([getBoardLeads({ point: "all", q: text }), getPartnerPrices()]);

  const orders = leads.slice(0, 6).map((l) => ({
    id: l.id,
    label: orderLabel(l),
    who: l.channel === "online" ? (l.externalNo ?? "магазин") : l.name,
    what: [l.model, l.problems.join(", ") || l.service].filter(Boolean).join(" · "),
    stage: l.flag === "refused" ? "відмова" : l.flag === "paused" ? "пауза" : l.stage === "issued" ? "видано" : STAGE_LABEL[l.stage].toLowerCase(),
  }));

  return { orders, prices: searchPrices(text, partner) };
}
