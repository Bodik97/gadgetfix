import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

import { cameFromSite } from "@/components/BackButton";

/**
 * «Назад» веде історією лише тоді, коли попередня сторінка — наша.
 * Прийшли з пошуку — ведемо на запасну адресу, а не назад у Google.
 */
const SITE = "https://gadgetfix.example";

function browser(opts: { index?: number; loaded?: string; path: string; referrer?: string }) {
  vi.stubGlobal("window", {
    location: { origin: SITE, pathname: opts.path },
    ...(opts.index === undefined ? {} : { navigation: { currentEntry: { index: opts.index } } }),
  });
  vi.stubGlobal("performance", {
    getEntriesByType: () => (opts.loaded ? [{ name: `${SITE}${opts.loaded}` }] : []),
  });
  vi.stubGlobal("document", { referrer: opts.referrer ?? "" });
}

afterEach(() => vi.unstubAllGlobals());

describe("cameFromSite", () => {
  it("перша сторінка сайту у вкладці — повертатись нікуди, хоч історія браузера й не порожня", () => {
    browser({ index: 0, path: "/modeli/iphone-13", referrer: "https://www.google.com/" });
    expect(cameFromSite()).toBe(false);
  });

  it("до цього вже була наша сторінка — можна назад", () => {
    browser({ index: 2, path: "/modeli/iphone-13", referrer: "https://www.google.com/" });
    expect(cameFromSite()).toBe(true);
  });

  describe("браузер без Navigation API", () => {
    it("з пошуку прямо на сторінку — не назад", () => {
      browser({ loaded: "/modeli/iphone-13", path: "/modeli/iphone-13", referrer: "https://www.google.com/" });
      expect(cameFromSite()).toBe(false);
    });

    it("без referrer (закладка, месенджер) — не назад", () => {
      browser({ loaded: "/modeli/iphone-13", path: "/modeli/iphone-13" });
      expect(cameFromSite()).toBe(false);
    });

    it("з пошуку на головну, далі сайтом без перезавантаження — назад", () => {
      browser({ loaded: "/", path: "/modeli/iphone-13", referrer: "https://www.google.com/" });
      expect(cameFromSite()).toBe(true);
    });

    it("сторінку відкрито з нашої ж — назад", () => {
      browser({ loaded: "/poslugy/ekran", path: "/poslugy/ekran", referrer: `${SITE}/poslugy` });
      expect(cameFromSite()).toBe(true);
    });
  });
});
