import type { Metadata } from "next";
import Link from "next/link";
import CountUp from "@/components/CountUp";
import BookingForm from "@/components/BookingForm";
import PriceSummary from "@/components/PriceSummary";
import Reveal from "@/components/Reveal";
import ServiceCatalog from "@/components/ServiceCatalog";
import Ticker from "@/components/Ticker";
import { services } from "@/data/services";
import { flow, promises, tickerItems } from "@/data/servicesPage";
import { serviceFrom, PRICES_PUBLISHED, uah } from "@/data/prices";
import { BUSINESS_ID, site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";
import { siteUrl } from "@/lib/siteUrl";
import HeroArt from "@/components/HeroArt";
import styles from "./page.module.css";

// Дві найчастіші роботи з цінами з прайсу — для опису в пошуку
const bookPoints = [
  "Діагностика безкоштовна, якщо ремонтуємо в нас",
  "Ціну фіксуємо до початку робіт",
  "Гарантія 2 місяці на аналог, 4 місяці на оригінал",
];

const screen = PRICES_PUBLISHED ? serviceFrom("zamina-ekrana") : null;
const battery = PRICES_PUBLISHED ? serviceFrom("akumuliator") : null;
const fromPrices =
  screen && battery ? `: екран — від ${uah(screen.price)}, акумулятор — від ${uah(battery.price)}` : "";

export const metadata: Metadata = {
  title: { absolute: `Ремонт iPhone ${site.citiesIn} — послуги й ціни` },
  description: `${services.length} видів ремонту iPhone, iPad і Apple Watch ${site.citiesIn}${fromPrices}. Безкоштовна діагностика при ремонті, фіксована ціна, гарантія ${WARRANTY_MAX}.`,
  alternates: { canonical: "/poslugy" },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: services.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Service",
      name: s.title,
      description: s.body,
      provider: { "@id": `${siteUrl()}${BUSINESS_ID}` },
      areaServed: site.cities,
    },
  })),
};

export default function ServicesPage() {
  return (
    <>
      {/* Герой */}
      <section className={`band ${styles.hero}`} data-theme="dark">
        <HeroArt name="tools" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1 className={`${styles.h1} nUp nUp-1`}>
              Послуги й ціни на ремонт iPhone
            </h1>

            <p className={`${styles.heroLead} nUp nUp-2`}>
              Від заміни екрана до діагностики складних випадків. Оберіть послугу — покажемо, як вона
              проходить і скільки триває.
            </p>

            <div className={`${styles.heroCta} nUp nUp-3`}>
              <Link href="#book" className="btn btn-accent btn-lg btn-hero">
                Записатись
              </Link>
              <Link href="/modeli" className="btn btn-ghost btn-lg">
                Обрати модель
              </Link>
            </div>
          </div>

        </div>
      </section>

      <div className="band stripe-alt">
        <Ticker items={tickerItems} />

        <ServiceCatalog />
      </div>

      <div className="band" data-theme="dark">
        <PriceSummary />
      </div>

      {/* Процес */}
      <section className={`band stripe-alt ${styles.process}`}>
        <div className={`container ${styles.processInner}`}>
          <h2 className={styles.processTitle}>Як проходить будь-яка робота</h2>

          <div className={styles.flowGrid}>
            {flow.map((f, i) => (
              <Reveal key={f.no} delay={i * 110} className={styles.flowItem}>
                <div className={styles.flowNo}>{f.no}</div>
                <div className={styles.bar}>
                  <div className={`${styles.barFill} anim-grow`} />
                </div>
                <h3 className={styles.flowTitle}>{f.title}</h3>
                <p className={styles.flowBody}>{f.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="band" data-theme="dark">
      {/* Показники */}
      <section className={`container ${styles.promises}`}>
        <div className={styles.promiseGrid}>
          {promises.map((p) => (
            <div key={p.note} className={`card ${styles.promise}`}>
              <div className={styles.promiseValue}>
                <CountUp value={p.value} />
              </div>
              <div className={styles.promiseNote}>{p.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Запис */}
      <section id="book" className={`container ${styles.book}`}>
        <div className={styles.bookGrid}>
          <div>
            <h2 className={styles.bookTitle}>Оберіть послугу — решту з&apos;ясуємо в розмові</h2>
            <p className={styles.bookLead}>
              Передзвонимо до 25 хвилин у робочі години й одразу скажемо орієнтир по ціні та терміну.
            </p>

            <div className={styles.contacts}>
              <div className={styles.contact}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
                </svg>
                <span>
                  {site.phones.map((p, i) => (
                    <span key={p.href}>
                      {i > 0 && " · "}
                      <a href={p.href} className={styles.contactLink}>
                        {p.label}
                      </a>
                    </span>
                  ))}
                </span>
              </div>

              <div className={styles.contact}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
                <span>
                  {site.hours} · {site.hoursNote}
                </span>
              </div>

              {bookPoints.map((text) => (
                <div key={text} className={styles.contact}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <BookingForm
            source="services"
            select={{
              name: "service",
              label: "Послуга",
              placeholder: "Оберіть послугу",
              options: services.map((s) => s.title),
            }}
            submitLabel="Записатись"
          />
        </div>
      </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
    </>
  );
}
