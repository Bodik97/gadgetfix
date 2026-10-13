import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Unbounded, Manrope } from "next/font/google";
import Header from "@/components/Header";
import BookingProviderWrap from "@/components/BookingModal";
import BottomNav from "@/components/BottomNav";
import HideOnAdmin from "@/components/HideOnAdmin";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import ChatBot from "@/components/ChatBot";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import ScrollReveal from "@/components/ScrollReveal";
import { jobRange, PRICED_JOBS, PRICES_PUBLISHED, uah } from "@/data/prices";
import { BUSINESS_ID, site } from "@/data/site";
import { siteUrl } from "@/lib/siteUrl";
import "./globals.css";

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "600"],
  variable: "--font-unbounded",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
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
        <ClerkProvider>
          <BookingProviderWrap>
          <Header />
          <main>{children}</main>
          {/* В адмінці підвал сайту — лише зайві два екрани гортання */}
          <HideOnAdmin>
            <Footer />
          </HideOnAdmin>
          <BottomNav />
          <ChatBot />
          <Analytics />
          <ScrollReveal />
          </BookingProviderWrap>
        </ClerkProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
        />
      </body>
    </html>
  );
}
