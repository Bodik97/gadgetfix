import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/kabinet(.*)", "/moi-remonty(.*)", "/moi-znyzhky(.*)"]);

/**
 * Сайт живе лише на власному домені (NEXT_PUBLIC_SITE_URL). Технічна адреса
 * продакшну *.vercel.app переадресовує туди, щоб її не індексували й не
 * поширювали. Лише відкриття сторінок: вебхуки й /api ходять POST-ами і за
 * переадресацією не йдуть. Preview-збірки не чіпаємо — їх перевіряють саме там.
 */
export function toOwnDomain(req: Request): NextResponse | null {
  const own = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (process.env.VERCEL_ENV !== "production" || !own) return null;
  if (req.method !== "GET" && req.method !== "HEAD") return null;

  const url = new URL(req.url);
  if (!url.hostname.endsWith(".vercel.app") || url.pathname.startsWith("/api/")) return null;

  return NextResponse.redirect(new URL(url.pathname + url.search, own), 308);
}

const clerk = clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect({ unauthenticatedUrl: new URL("/vhid", req.url).toString() });
  }
});

/** Де сервер сам питає Clerk, хто це: адмінка, кабінет, вхід, API */
const needsClerk = createRouteMatcher([
  "/admin(.*)",
  "/api(.*)",
  "/trpc(.*)",
  "/vhid(.*)",
  "/kabinet(.*)",
  "/moi-remonty(.*)",
  "/moi-znyzhky(.*)",
]);

/**
 * Clerk на сервері — лише там, де він потрібен. На тестових ключах він при
 * першому відкритті будь-якої сторінки ганяв браузер на clerk.accounts.dev і
 * назад («handshake», 3 переадресації й +0,6 с ще до першого байта). Публічним
 * сторінкам це ні до чого: кнопку «Вхід» показує браузерна частина Clerk.
 * Відправка форм (server actions) — POST на адресу сторінки, їй Clerk потрібен.
 */
export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const moved = toOwnDomain(req);
  if (moved) return moved;

  const reading = req.method === "GET" || req.method === "HEAD";
  if (!reading || needsClerk(req)) return clerk(req, event);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Пропускаємо внутрішні файли Next.js, статику і службові запити Workflow
    // (інакше Clerk перехоплює їхній POST, і заснуле нагадування не прокидається)
    "/((?!_next|\\.well-known/workflow/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
