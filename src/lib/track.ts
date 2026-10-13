import { createHash } from "node:crypto";
import { CLICK_LABELS } from "@/app/admin/statystyka/labels";

/**
 * Розбір і знеособлення подій статистики. Чисті функції без бази —
 * маршрут /api/track лише збирає їх докупи.
 */

export type TrackEvent = {
  kind: "view" | "click";
  path: string;
  name: string | null;
  referrer: string | null;
  utm: string | null;
};

const short = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** Чужий хост без www; свій сайт, порожнє й сміття — null */
export function refHost(ref: unknown, ownHost: string): string | null {
  if (typeof ref !== "string" || !ref) return null;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    return host && host !== ownHost.replace(/^www\./, "") ? host.slice(0, 100) : null;
  } catch {
    return null;
  }
}

/** null — подію не приймаємо: не той вид, немає шляху, це адмінка чи невідома кнопка */
export function parseEvent(body: unknown, ownHost: string): TrackEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  if (b.kind !== "view" && b.kind !== "click") return null;

  const path = short(b.path, 200);
  if (!path || !path.startsWith("/") || path.startsWith("/admin")) return null;

  // Кнопки — лише ті, що справді є на сайті: інакше в статистику можна вписати що завгодно
  const name = short(b.name, 60);
  if (b.kind === "click" && (!name || !Object.hasOwn(CLICK_LABELS, name))) return null;

  return {
    kind: b.kind,
    path,
    name: b.kind === "click" ? name : null,
    referrer: refHost(b.ref, ownHost),
    utm: short(b.utm, 60),
  };
}

export function isBot(ua: string): boolean {
  return !ua || /bot|crawl|spider|slurp|preview|monitor|lighthouse|headless|curl|wget|python|vercel/i.test(ua);
}

export function deviceOf(ua: string): "mobile" | "desktop" {
  return /mobi|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
}

/** Денний знеособлений ідентифікатор: з нього не відновити ні адресу, ні браузер */
export function visitorHash(ip: string, ua: string, day: string, salt: string): string {
  return createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 24);
}
