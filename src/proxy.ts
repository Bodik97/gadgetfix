import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/moi-remonty(.*)"]);

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

export default clerkMiddleware(async (auth, req) => {
  const moved = toOwnDomain(req);
  if (moved) return moved;

  if (isProtected(req)) {
    await auth.protect({ unauthenticatedUrl: new URL("/vhid", req.url).toString() });
  }
});

export const config = {
  matcher: [
    // Пропускаємо внутрішні файли Next.js, статику і службові запити Workflow
    // (інакше Clerk перехоплює їхній POST, і заснуле нагадування не прокидається)
    "/((?!_next|\\.well-known/workflow/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
