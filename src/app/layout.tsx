import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
import AuthRoot from "@/components/auth/AuthRoot";
import BookingProviderWrap from "@/components/BookingModal";
import BottomNav from "@/components/BottomNav";
import HideOnAdmin from "@/components/HideOnAdmin";
import TouchSparks from "@/components/TouchSparks";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import ChatBot from "@/components/ChatBot";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollTop from "@/components/ScrollTop";
import { jobRange, PRICED_JOBS, PRICES_PUBLISHED, uah } from "@/data/prices";
import { BUSINESS_ID, site } from "@/data/site";
import { siteUrl } from "@/lib/siteUrl";
import "./globals.css";

// Шрифти лежать на сайті, а не тягнуться з Google: по одному файлу на шрифт замість
// пʼяти, лише потрібні символи й товщини — 84 КБ замість 124 КБ (scripts/subset-fonts.py).
// У Unbounded — лише символи, що є в коді сайту (заголовки пишемо ми); у Manrope —
// повна кирилиця й латиниця з наголосами: ним показуємо тексти клієнтів
const unbounded = localFont({
  src: "./fonts/unbounded.woff2",
  weight: "300 700",
  variable: "--font-unbounded",
  display: "swap",
});

const manrope = localFont({
  src: "./fonts/manrope.woff2",
  weight: "400 700",
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "GadgetFix — ремонт iPhone у Львові та Новому Роздолі",
    template: "%s · GadgetFix",
  },
  description: site.tagline,
  openGraph: {
    type: "website",
    locale: "uk_UA",
    siteName: site.name,
  },
};

// Вилка цін по всьому прайсу — для priceRange у розмітці
const allPrices = PRICED_JOBS.flatMap((job) => {
  const range = jobRange(job);
  return range ? [range.min, range.max] : [];
});

const localBusiness = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  // Сторінки послуг і моделей посилаються на цей вузол як на виконавця
  "@id": `${siteUrl()}${BUSINESS_ID}`,
  name: site.name,
  description: site.tagline,
  url: siteUrl(),
  image: `${siteUrl()}/opengraph-image.png`,
  telephone: site.phones.map((p) => p.href.replace("tel:", "")),
  ...(PRICES_PUBLISHED && { priceRange: `${uah(Math.min(...allPrices))} – ${uah(Math.max(...allPrices))}` }),
  areaServed: site.cities.map((city) => ({ "@type": "City", name: city })),
  address: site.cities.map((city) => ({
    "@type": "PostalAddress",
    addressLocality: city,
    addressCountry: "UA",
  })),
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "08:00",
    closes: "18:00",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uk"
      // Типова тема — світла; збережений вибір відвідувача підставляє скрипт нижче
      data-theme="light"
      data-scroll-behavior="smooth"
      className={`${unbounded.variable} ${manrope.variable}`}
      // Тему ставить скрипт нижче ще до гідратації — атрибут на <html> різнитиметься
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AuthRoot>
          <BookingProviderWrap>
          <Header />
          <main>{children}</main>
          {/* В адмінці підвал сайту — лише зайві два екрани гортання */}
          <HideOnAdmin>
            <Footer />
          </HideOnAdmin>
          <BottomNav />
          <ChatBot />
          <ScrollTop />
          <Analytics />
          <ScrollReveal />
          <TouchSparks />
          </BookingProviderWrap>
        </AuthRoot>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
        />
      </body>
    </html>
  );
}
