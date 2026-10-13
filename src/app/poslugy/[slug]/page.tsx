import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "@/components/BackButton";
import BookLink from "@/components/BookLink";
import Reveal from "@/components/Reveal";
import ServicePrices from "@/components/ServicePrices";
import { serviceDetails } from "@/data/serviceDetails";
import { services } from "@/data/services";
import { iphones } from "@/data/models";
import { boardPrices, jobRange, PRICED_JOBS, PRICES_PUBLISHED, serviceFrom, uah, type PricedJob } from "@/data/prices";
import { BUSINESS_ID, site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";
import { siteUrl } from "@/lib/siteUrl";
import styles from "./page.module.css";

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

const iphoneSlugs = iphones.map((m) => m.slug);

const isPriced = (slug: string): slug is PricedJob => (PRICED_JOBS as readonly string[]).includes(slug);

/**
 * Ціна для заголовка, шапки й розмітки. У робіт із таблицею по моделях —
 * вилка по самих iPhone: сторінка називається «… iPhone», і «від» має бути
 * про них, а не про найдешевший планшет чи годинник.
 */
function priceOf(slug: string): { low: number; high?: number; exact: boolean } | null {
  if (!PRICES_PUBLISHED) return null;

  if (isPriced(slug)) {
    const range = jobRange(slug, iphoneSlugs);
    return range && { low: range.min, high: range.max, exact: false };
  }

  const from = serviceFrom(slug);
  return from && { low: from.price, high: from.exact ? from.price : undefined, exact: from.exact };
}

/** Роботи «після діагностики»: сума — лише орієнтир, у заголовок її не виносимо */
const isBoard = (slug: string) => boardPrices.some((b) => b.slug === slug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);
  const detail = serviceDetails[slug];
  if (!service || !detail) return {};

  const price = priceOf(slug);
  const name = `${detail.h1} ${site.citiesIn}`;
  const sum = price && `${price.exact ? "" : "від "}${uah(price.low)}`;

  // Довгу назву з ціною пошуковик обріже — тоді ціна лишається тільки в описі
  const withPrice = sum && !isBoard(slug) ? `${name} — ${sum}` : name;

  const first = !sum
    ? `${name}.`
    : isBoard(slug)
      ? `${name}. Діагностика безкоштовна, роботи — ${sum}.`
      : `${name} — ${sum}${isPriced(slug) ? " разом із деталлю" : ""}.`;
  // Гарантію обіцяємо лише там, де вона є в переліку «Що входить у ціну»
  const warranty = detail.included.some((x) => x.startsWith("Гарантія"))
    ? `, гарантія ${WARRANTY_MAX}${isBoard(slug) ? "" : " на роботу й деталь"}`
    : "";

  return {
    title: { absolute: withPrice.length <= 65 ? withPrice : name },
    description: `${first} Ціну фіксуємо до початку робіт${warranty}.`,
    alternates: { canonical: `/poslugy/${service.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const service = services.find((s) => s.slug === slug);
  const detail = serviceDetails[slug];
  if (!service || !detail) notFound();

  const price = priceOf(slug);

  const base = siteUrl();
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: detail.h1,
      description: service.body,
      url: `${base}/poslugy/${service.slug}`,
      provider: { "@id": `${base}${BUSINESS_ID}` },
      areaServed: site.cities,
      ...(price && {
        offers: price.exact
          ? { "@type": "Offer", price: price.low, priceCurrency: "UAH" }
          : {
              "@type": "AggregateOffer",
              lowPrice: price.low,
              ...(price.high !== undefined && { highPrice: price.high }),
              priceCurrency: "UAH",
            },
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Головна", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "Послуги", item: `${base}/poslugy` },
        { "@type": "ListItem", position: 3, name: service.title, item: `${base}/poslugy/${service.slug}` },
      ],
    },
  ];

  const others = services.filter((s) => s.slug !== slug && serviceDetails[s.slug]).slice(0, 4);

  return (
    <>
    <div className="band" data-theme="dark">
    <div className={styles.page}>
      <div className={styles.navRow}>
        <BackButton fallback="/poslugy" />
        <nav className={styles.crumbs} aria-label="Хлібні крихти">
          <Link href="/">Головна</Link>
          <span className={styles.sep}>/</span>
          <Link href="/poslugy">Послуги</Link>
          <span className={styles.sep}>/</span>
          <span className={styles.current}>{service.title}</span>
        </nav>
      </div>

      <header className={styles.hero}>
        <span className={styles.icon} aria-hidden="true">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: service.icon }}
          />
        </span>

        <h1 className={styles.h1}>{detail.h1}</h1>
        <p className={styles.intro}>{detail.intro}</p>

        <div className={styles.meta}>
          <span className={styles.time}>{service.time}</span>
          {service.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
          {price && (
            <span className={styles.price}>
              {!price.exact && "від "}
              {uah(price.low)}
            </span>
          )}
        </div>

        <div className={styles.cta}>
          <BookLink service={service.title} className="btn btn-accent btn-lg btn-hero">
            Записатись
          </BookLink>
          <a href={site.phones[0].href} className="btn btn-ghost btn-lg">
            {site.phones[0].label}
          </a>
        </div>
      </header>

      {detail.warning && (
        <aside className={styles.warning}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.5l9 16H3z" />
            <path d="M12 10v4" />
            <path d="M12 17v.1" />
          </svg>
          <p>{detail.warning}</p>
        </aside>
      )}

      {isPriced(slug) && <ServicePrices job={slug} />}

    </div>
    </div>

    <div className="band stripe-alt">
    <div className={styles.page}>
      <section className={styles.section} aria-labelledby="oznaky">
        <h2 id="oznaky" className={styles.h2}>
          Коли це до нас
        </h2>
        <ul className={styles.signs}>
          {detail.signs.map((s) => (
            <li key={s}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="yak">
        <h2 id="yak" className={styles.h2}>
          Як ми це робимо
        </h2>
        <ol className={styles.steps}>
          {detail.how.map((step, i) => (
            <Reveal key={step.title} delay={i * 90}>
              <li className={styles.step}>
                <span className={styles.stepNo}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepBody}>{step.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="vhodyt">
        <h2 id="vhodyt" className={styles.h2}>
          Що входить у ціну
        </h2>
        <ul className={styles.included}>
          {detail.included.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className={styles.note}>
          Точну суму називаємо після безкоштовної діагностики, і далі вона не змінюється. Ремонт
          іде за передоплатою за деталь — решту сплачуєте при видачі.
        </p>
      </section>

    </div>
    </div>

    <div className="band" data-theme="dark">
    <div className={styles.page}>
      <section className={styles.section} aria-labelledby="inshi">
        <h2 id="inshi" className={styles.h2}>
          Інші роботи
        </h2>
        <div className={styles.others}>
          {others.map((s) => (
            <Link key={s.slug} href={`/poslugy/${s.slug}`} className={styles.other}>
              <span className={styles.otherTitle}>{s.title}</span>
              <span className={styles.otherTime}>{s.time}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
    </div>

    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
    />
    </>
  );
}
