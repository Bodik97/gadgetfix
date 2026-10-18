import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

/**
 * Домен Frontend API Clerk — з publishable-ключа, а не з коду: ключ має вигляд
 * pk_test_<base64("host$")>. На продакшні ключ live, і домен підставиться свій.
 */
function clerkFrontendApi(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const encoded = key.split("_")[2];
  if (!encoded) return null;
  const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
}

/**
 * CSP без nonce. Nonce вимагає динамічного рендеру всіх сторінок, а каталог
 * моделей і послуг статичний — тож inline-скрипти дозволені (ними Next
 * гідратує сторінку), зате все зовнішнє — лише з переліченого.
 *
 * Джерела Clerk — за його документацією: Frontend API, захист від ботів
 * Cloudflare (капча при реєстрації), *.protect.clerk.com, аватари img.clerk.com,
 * воркери з blob:. 'unsafe-eval' — лише в dev, його просить React для дебагу.
 */
function contentSecurityPolicy(): string {
  const clerk = clerkFrontendApi() ?? "";
  const dev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${clerk} https://challenges.cloudflare.com https://*.protect.clerk.com`,
    // :* — захист Clerk від ботів ходить на порти, відмінні від 443 (за документацією Clerk про CSP)
    `connect-src 'self' ${clerk} https://*.protect.clerk.com:*`,
    "img-src 'self' blob: data: https://img.clerk.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "frame-src https://challenges.cloudflare.com https://*.protect.clerk.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Заборона вбудовувати сайт у фрейм — щоб адмінку не підсунули під чужу сторінку
    "frame-ancestors 'none'",
  ]
    .map((d) => d.replace(/\s+/g, " ").trim())
    .join("; ");
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  poweredByHeader: false,

  // Оптимізатор картинок стискає й зменшує лише ці шляхи. Фото відгуків —
  // з приватного сховища через свій маршрут: ?v= лише before/after.
  images: {
    localPatterns: [
      { pathname: "/assets/**", search: "" },
      { pathname: "/api/reviews/*/image", search: "" },
      { pathname: "/api/reviews/*/image", search: "?v=before" },
      { pathname: "/api/reviews/*/image", search: "?v=after" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

// withWorkflow — директиви "use workflow" / "use step" (ескалація нових заявок)
export default withWorkflow(nextConfig);
