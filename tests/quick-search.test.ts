import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ admin: true as boolean, q: [] as string[] }));
vi.mock("@/lib/admin", () => ({ currentAdmin: async () => (m.admin ? { email: "b@x.ua" } : null) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/db/board", () => ({
  getBoardLeads: async (f: { q: string }) => {
    m.q.push(f.q);
    return [];
  },
  getPartnerPrices: async () => [{ model: "Redmi 13C", work: "АКБ", price: 400 }],
}));

import { quickSearch } from "@/app/admin/searchAction";
import { searchPrices } from "@/lib/priceSearch";

/** Ctrl+K: заявки й ціни. Пошук бачить дані клієнтів — лише для тих, хто увійшов. */

describe("searchPrices", () => {
  it("«13 pro екран» — знаходить iPhone 13 Pro, коротша назва вище за Pro Max", () => {
    const hits = searchPrices("13 pro екран", []);
    expect(hits[0].title).toBe("iPhone 13 Pro · Заміна екрана");
    expect(hits.some((h) => h.title.startsWith("iPhone 13 Pro Max"))).toBe(true);
  });

  it("прайс магазину позначено окремо", () => {
    const [hit] = searchPrices("redmi акб", [{ model: "Redmi 13C", work: "АКБ", price: 400 }]);
    expect(hit).toEqual({ title: "Redmi 13C · АКБ", price: "400 ₴", online: true });
  });

  it("порожній запит — нічого", () => {
    expect(searchPrices("   ", [])).toEqual([]);
  });
});

describe("quickSearch", () => {
  it("без входу — на сторінку входу, база не чіпається", async () => {
    m.admin = false;
    m.q = [];
    await expect(quickSearch("1092")).rejects.toThrow("REDIRECT:/admin/vhid");
    expect(m.q).toEqual([]);
    m.admin = true;
  });

  it("один символ — не шукаємо", async () => {
    m.q = [];
    expect(await quickSearch("1")).toEqual({ orders: [], prices: [] });
    expect(m.q).toEqual([]);
  });

  it("запит обрізаний і переданий у пошук заявок", async () => {
    m.q = [];
    const res = await quickSearch("  redmi акб ");
    expect(m.q).toEqual(["redmi акб"]);
    expect(res.prices[0]).toMatchObject({ title: "Redmi 13C · АКБ", online: true });
  });
});
