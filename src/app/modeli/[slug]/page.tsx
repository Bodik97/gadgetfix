import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import BackButton from "@/components/BackButton";
import BookLink from "@/components/BookLink";
import ModelJobs from "@/components/ModelJobs";
import { getModelPrice, PRICED_JOBS, PRICES_PUBLISHED, uah, type JobPrice } from "@/data/prices";
import { allModels, getModel, relatedTo, sectionOf } from "@/data/catalog";
import type { DeviceKind, Model } from "@/data/models";
import { BUSINESS_ID, site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";
import { siteUrl } from "@/lib/siteUrl";
import Ticker from "@/components/Ticker";
import { tickerItems } from "@/data/servicesPage";
import styles from "./page.module.css";

export function generateStaticParams() {
  return allModels.map((m) => ({ slug: m.slug }));
}

/**
 * Назва для пошуковика. У кількох iPad вона однакова («iPad Pro 12.9″» чотирьох
 * років) — додаємо рік, інакше заголовки сторінок збігались би.
 */
function seoName(model: Model): string {
  const twins = allModels.filter((m) => m.name === model.name).length > 1;
  return twins ? `${model.name} (${model.year})` : model.name;
}

/** iPhone з кнопкою Home: Face ID у них немає, і обіцяти його перевірку не можна */
const hasHomeButton = (slug: string) => /^iphone-(6|7|8|se)/.test(slug);

/** Що саме перевіряємо перед видачею — у кожного виду пристрою своє */
function checkLine(kind: DeviceKind, slug: string): string {
  if (kind === "ipad") return "Тестуємо сенсор, заряджання й камери перед тим, як зібрати, а зняту деталь віддаємо вам.";
  if (kind === "watch") return "Тестуємо сенсор, заряджання й кнопки перед тим, як зібрати, а зняту деталь віддаємо вам.";
  if (hasHomeButton(slug)) return "Тестуємо сенсор, кнопку Home і камери перед тим, як зібрати, а знятий модуль віддаємо вам.";
  return "Тестуємо сенсор, True Tone і Face ID перед тим, як зібрати, а знятий модуль віддаємо вам.";
}

/** «3 350 ₴» або «від 3 350 ₴», коли деталь буває двох рівнів */
const fromPrice = (p: JobPrice) => (typeof p === "number" ? uah(p) : `від ${uah(p.analog)}`);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const model = getModel(slug);
  if (!model) return {};

  const name = `Ремонт ${seoName(model)} ${site.citiesIn}`;
  const withPrices = `${name} — ціни`;

  // Дві-три справжні ціни цієї моделі — те, що людина й шукає
  const prices = PRICES_PUBLISHED ? getModelPrice(model.slug) : undefined;
  const list = (
    [
      ["zamina-ekrana", "заміна екрана"],
      ["akumuliator", "акумулятора"],
      ["roziem-zariadzhannia", "роз'єму"],
    ] as const
  )
    .flatMap(([job, label]) => {
      const p = prices?.[job];
      return p === undefined ? [] : [`${label} — ${fromPrice(p)}`];
    })
    .join(", ");

  return {
    title: { absolute: withPrices.length <= 62 ? withPrices : name },
    description: `${name}${list ? `: ${list}` : ""}. Діагностика безкоштовна, гарантія ${WARRANTY_MAX}.`,
    alternates: { canonical: `/modeli/${model.slug}` },
  };
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = getModel(slug);
  if (!model) notFound();

  const section = sectionOf(model.slug);
  const related = relatedTo(model.slug);

  const warranty = [
    {
      no: "01",
      title: "Перевірка перед видачею",
      body: checkLine(section.kind, model.slug),
    },
    {
      no: "02",
      title: "Дані на місці",
      body: "Нічого не скидаємо і не переносимо. Пароль потрібен лише для фінальної перевірки.",
    },
    {
      no: "03",
      title: `Гарантія ${WARRANTY_MAX}`,
      body: "2 місяці на аналог, 4 місяці на оригінал — на роботу й на деталь. Щось пішло не так — повертайтесь без питань.",
    },
  ];

  const prices = getModelPrice(model.slug);
  // Суми по кожній роботі з прайсу моделі — для вилки в розмітці
  const offers = PRICES_PUBLISHED
    ? PRICED_JOBS.flatMap((job) => {
        const p = prices?.[job];
        return p === undefined ? [] : [typeof p === "number" ? [p] : [p.analog, p.original]];
      })
    : [];
  const sums = offers.flat();

  const base = siteUrl();
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `Ремонт ${seoName(model)}`,
      serviceType: model.jobs.join(", "),
      url: `${base}/modeli/${model.slug}`,
      provider: { "@id": `${base}${BUSINESS_ID}` },
      areaServed: site.cities,
      ...(sums.length > 0 && {
        offers: {
          "@type": "AggregateOffer",
          lowPrice: Math.min(...sums),
          highPrice: Math.max(...sums),
          priceCurrency: "UAH",
          offerCount: offers.length,
        },
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Головна", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: section.tab, item: `${base}${section.href}` },
        { "@type": "ListItem", position: 3, name: model.name, item: `${base}/modeli/${model.slug}` },
      ],
    },
  ];

  return (
    <>
      <section className={`band ${styles.hero}`} data-theme="dark">
        <div className={styles.heroInner}>
          <div className={styles.navRow}>
            <BackButton fallback={section.href} />

            <nav className={styles.crumbs} aria-label="Хлібні крихти">
              <Link href="/">Головна</Link>
              <span className={styles.sep}>/</span>
              <Link href={section.href}>{section.tab}</Link>
              <span className={styles.sep}>/</span>
              <span className={styles.current}>{model.name}</span>
            </nav>
          </div>

          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={`${styles.badge} nUp`}>
                <span className="pulse" />
                Безкоштовна діагностика · гарантія {WARRANTY_MAX}
              </span>

              <h1 className={`${styles.h1} nUp nUp-1`}>Ремонт {model.name}</h1>

              <p className={`${styles.heroLead} nUp nUp-2`}>
                На найчастіші роботи йде {model.time} разом із замовленням деталі. Ціну називаємо після безкоштовної
                діагностики — і вона вже не змінюється.
              </p>

              <div className={`${styles.heroCta} nUp nUp-3`}>
                <BookLink model={model.name} className="btn btn-accent btn-lg btn-hero">
                  Записатись
                </BookLink>
                <a href={site.phones[0].href} className="btn btn-ghost btn-lg">
                  Спитати про модель
                </a>
              </div>
            </div>

            <div className={styles.heroShot}>
              {model.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={model.image} alt={`${model.name} — ремонт ${site.citiesIn}`} className={styles.shotPhoto} />
              ) : (
                <span className={styles.shotCaption}>{model.name}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="band stripe-alt">
        <Ticker items={tickerItems} />
        <ModelJobs
          prices={prices}
          name={model.name}
          time={model.time}
          faceId={section.kind === "iphone" && !hasHomeButton(model.slug)}
        />
      </div>

      <div className="band" data-theme="dark">
      <section className={styles.warranty}>
        <div className={`container ${styles.warrantyGrid}`}>
          {warranty.map((w) => (
            <div key={w.no}>
              <div className={styles.wNo}>{w.no}</div>
              <span className={`${styles.wLine} anim-grow`} />
              <h3 className={styles.wTitle}>{w.title}</h3>
              <p className={styles.wBody}>{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="book" className={`container ${styles.book}`}>
        <div className={styles.bookGrid}>
          <div>
            <h2 className={styles.bookTitle}>Записатись на {model.name}</h2>
            <p className={styles.bookLead}>
              Залиште телефон — передзвонимо до 25 хвилин і скажемо орієнтир по вашій ситуації.
            </p>

            <div className={styles.related}>
              {related.map((r) => (
                <Link key={r.slug} href={`/modeli/${r.slug}`} className={styles.relatedLink}>
                  <span>{r.name}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M5 12h13" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </Link>
              ))}
              <Link href={section.href} className={styles.relatedLink}>
                <span>Усі моделі: {section.tab}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h13" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>

          <BookingForm source="model" model={model.name} submitLabel="Записатись" />
        </div>
      </section>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    </>
  );
}
