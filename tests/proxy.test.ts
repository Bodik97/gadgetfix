import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (fn: unknown) => fn,
  createRouteMatcher: () => () => false,
}));

import { toOwnDomain } from "@/proxy";

/**
 * Сайт відкривається лише з власного домену: технічна адреса *.vercel.app
 * у продакшні переадресовує туди, але службових запитів це не зачіпає.
 */
const OWN = "https://own.example";

describe("toOwnDomain", () => {
  afterEach(() => vi.unstubAllEnvs());

  const prod = () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", OWN);
  };

  it("сторінка з *.vercel.app у продакшні — 308 на свій домен зі шляхом і параметрами", () => {
    prod();
    const res = toOwnDomain(new Request("https://proj-x.vercel.app/poslugy?a=1"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe(`${OWN}/poslugy?a=1`);
  });

  it("власний домен, /api, POST і preview не чіпаємо", () => {
    prod();
    expect(toOwnDomain(new Request(`${OWN}/`))).toBeNull();
    expect(toOwnDomain(new Request("https://proj-x.vercel.app/api/telegram/client"))).toBeNull();
    expect(toOwnDomain(new Request("https://proj-x.vercel.app/", { method: "POST" }))).toBeNull();

    vi.stubEnv("VERCEL_ENV", "preview");
    expect(toOwnDomain(new Request("https://proj-git-x.vercel.app/"))).toBeNull();
  });

  it("без NEXT_PUBLIC_SITE_URL нікуди не переадресовуємо", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(toOwnDomain(new Request("https://proj-x.vercel.app/"))).toBeNull();
  });
});
