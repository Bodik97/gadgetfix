import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Accordion from "@/components/Accordion";
import BookingForm from "@/components/BookingForm";
import CountUp from "@/components/CountUp";
import FaqAside from "@/components/FaqAside";
import HeroStatus from "@/components/HeroStatus";
import PhoneStrip from "@/components/PhoneStrip";
import Reveal from "@/components/Reveal";
import ReviewForm from "@/components/ReviewForm";
import ReviewShowcase from "@/components/ReviewShowcase";
import WorkSlider from "@/components/WorkSlider";
import ParcelDecor from "@/components/ParcelDecor";
import StatusCheck from "@/components/StatusCheck";
import { getPublishedReviews, getReviewStats } from "@/db/reviews";
import { getWorks } from "@/db/works";
import { services } from "@/data/services";
import { site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";
import { getModel } from "@/data/catalog";
import { iphoneImage } from "@/data/deviceImage";
import {
  bookingModels,
  faq,
  heroStats,
  howItWorks,
  mailInSteps,
  modelGroups,
  topServices,
} from "@/data/landing";
import styles from "./page.module.css";

/** Моделі для каруселі на головній — від нових до старших, без однакових фото */
const stripModels = [
  "iphone-16-pro-max",
  "iphone-16",
  "iphone-15-pro-max",
  "iphone-15",
  "iphone-14-pro",
  "iphone-13-pro",
  "iphone-13",
  "iphone-12-pro",
  "iphone-11-pro",
  "iphone-11",
  "iphone-x",
  "iphone-se-2",
  "iphone-8",
].flatMap((slug) => {
  const m = getModel(slug);
  // Без фото в стрічці нічого показати — модель пропускаємо
  return m?.image ? [{ name: m.name, slug: m.slug, img: m.image, year: m.year }] : [];
});

export const metadata: Metadata = {
  title: "GadgetFix — ремонт iPhone у Львові та Новому Роздолі",
  description: `Ремонт iPhone ${site.citiesIn}: безкоштовна діагностика, фіксована ціна, гарантія ${WARRANTY_MAX}. Екран чи акумулятор — до 2 днів разом із деталлю. Приймаємо й Новою Поштою.`,
  alternates: { canonical: "/" },
};

/**
 * Головна статична: опубліковані відгуки перечитуються раз на 5 хвилин, а
 * публікація з адмінки оновлює її одразу через revalidatePath("/"). Хто
 * увійшов і чи вже лишав відгук — форма дізнається сама, у браузері.
 */
export const revalidate = 300;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const reviewDate = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Kyiv",
});

export default async function Home() {
  const [published, works, reviewStats] = await Promise.all([
    getPublishedReviews(8),
    getWorks(12),
    getReviewStats(),
  ]);
  const shownReviews = published.map((r) => ({
    id: r.id,
    text: r.text,
    name: r.authorName,
    city: r.city,
    device: r.device,
    deviceImage: iphoneImage(r.device),
    date: reviewDate.format(r.createdAt),
    viaGoogle: r.viaGoogle,
    avatar: r.avatarUrl,
    rating: r.rating,
    // Фото роботи лежить у приватному сховищі — віддаємо своїм маршрутом
    image: r.imagePath ? `/api/reviews/${r.id}/image` : null,
    // Пара від клієнта: показуємо лише обидва фото разом, інакше порівнювати нічого
    pair:
      r.beforePath && r.afterPath
        ? { before: `/api/reviews/${r.id}/image?v=before`, after: `/api/reviews/${r.id}/image?v=after` }
        : null,
  }));

  const hasRealReviews = published.length > 0;

  return (
    <>
      {/* Герой */}
      <section className={`band ${styles.hero}`} data-theme="dark">
        <div className={styles.heroInner}>
          {/* Великий логотип над заголовком. Кольори логотипа не змінюються,
              а герой темний в обох темах — плашка не потрібна. */}
          <div className={`${styles.heroLogo} nUp`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- векторний SVG, оптимізатор картинок тут нічого не дасть */}
            <img src="/brand/gadgetfix-logo-dark.svg" alt={site.name} width={739} height={136} />
          </div>

          <HeroStatus />

          <h1 className={`${styles.h1} nUp nUp-1`}>Ремонт iPhone без сюрпризів у ціні</h1>

          <p className={`${styles.heroLead} nUp nUp-2`}>
            Безкоштовна діагностика, потім фіксована ціна — і вона вже не змінюється. На екран чи
            акумулятор іде до 2 днів разом із замовленням деталі.
          </p>

          <div className={`${styles.heroCta} nUp nUp-3`}>
            <Link href="#book" className="btn btn-accent btn-lg btn-hero" data-track="hero-book">
              Безкоштовна діагностика
            </Link>
            <a href={site.phones[0].href} className="btn btn-ghost btn-lg" data-track="hero-call">
              Подзвонити
            </a>
          </div>

          <div aria-hidden="true" className={`${styles.heroShot} nUp nUp-3`}>
            {/* Найбільше на першому екрані — вантажимо першим, телефону віддаємо менший розмір */}
            <Image src="/assets/hero-exploded.webp" alt="" fill preload sizes="(max-width: 1100px) 100vw, 1040px" className={styles.heroShotImg} />
          </div>

          <dl className={styles.stats}>
            {heroStats.map((s) => (
              <div key={s.note} className={styles.stat}>
                <dt className={styles.statValue}>
                  <CountUp value={s.value} />
                  <span className={styles.statUnit}>{s.unit}</span>
                </dt>
                <dd className={styles.statNote}>{s.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Послуги */}
      <section id="services" className="band stripe-alt">
        <div className={`container ${styles.block}`}>
          <div className={styles.head}>
            <h2 className={styles.h2}>Усе, що трапляється з iPhone</h2>
            <p className={styles.headNote}>
              Оригінальні дисплеї або якісні аналоги — показуємо обидва варіанти й різницю в ціні.
            </p>
          </div>

          <div className={styles.serviceGrid}>
            {topServices.map((s) => {
              const icon = services.find((x) => x.slug === s.slug)?.icon;
              return (
                <Link key={s.slug} href={`/poslugy/${s.slug}`} className={`card ${styles.serviceCard}`}>
                  <span className={styles.serviceIcon}>
                    {icon && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ stroke: "var(--accent-text)" }}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: icon }}
                      />
                    )}
                  </span>

                  <h3>{s.title}</h3>
                  <p className={styles.serviceBody}>{s.body}</p>
                  <span className={styles.serviceMeta}>{s.meta}</span>
                </Link>
              );
            })}
          </div>

          <p className={styles.blockLink}>
            <Link href="/poslugy">Усі 12 послуг детально</Link>
          </p>
        </div>
      </section>

      {/* Репутація */}
      <section className="band" data-theme="dark">
        <div className={`${styles.bandArt} ${styles.bandArtCity}`} aria-hidden="true" />
        <div className={`container ${styles.statement}`}>
          <h2 className={styles.statementTitle}>Кожен ремонт — це наша репутація в місті</h2>
          <p className={styles.statementText}>
            Ми невеликий сервіс. Простіше зробити добре з першого разу, ніж потім комусь дивитися в
            очі. Тому показуємо зняті деталі, ємність акумулятора до і після — і не міняємо ціну на
            ходу.
          </p>
        </div>
      </section>

      {/* Як це працює */}
      <section id="how" className="band stripe-alt">
        <div className={`container ${styles.block}`}>
          <div className={styles.head}>
            <h2 className={styles.h2}>Три кроки — і телефон знову ваш</h2>
          </div>

          <ol className={styles.steps}>
            {howItWorks.map((s, i) => (
              <li key={s.no} className={styles.step}>
                <Reveal delay={i * 110}>
                  <span aria-hidden="true" className={styles.stepNo}>
                    {i + 1}
                  </span>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepBody}>{s.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Моделі */}
      <section id="models" className="band" data-theme="dark">
        <div className={`container ${styles.block}`}>
          <div className={styles.head}>
            <h2 className={styles.h2}>Які пристрої беремо</h2>
            <p className={styles.headNote}>Деталь під вашу модель підбираємо одразу після заявки.</p>
          </div>

          <PhoneStrip models={stripModels} />

          <div className={styles.groupList}>
            {modelGroups.map((g) => (
              <div key={g.label} className={styles.group}>
                <div className={styles.groupLabel}>{g.label}</div>
                <div className={styles.groupItems}>
                  {g.items.map((m) => (
                    <span key={m} className={styles.modelChip}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className={styles.modelsNote}>
            Не знайшли свою модель — <a href={site.phones[0].href}>зателефонуйте</a>, майже завжди
            беремо. <Link href="/modeli">Усі моделі детально</Link> ·{" "}
            <Link href="/android">Ремонт Android</Link>
          </p>
        </div>
      </section>

      {/* Результати робіт і відгуки — одна смуга: спершу показуємо, потім розповідають клієнти */}
      <section className="band stripe-alt">
        <div className={`container ${styles.block}`}>
          {works.length > 0 && (
            <div className={styles.works}>
              <div className={styles.reviewsHead}>
                <h2 className={styles.h2}>Результати робіт</h2>
              </div>
              <WorkSlider works={works.map((w) => ({ id: w.id, device: w.device, text: w.text }))} />
            </div>
          )}

          <div className={styles.reviewsHead}>
            <h2 className={styles.h2}>Що кажуть клієнти</h2>
          </div>

          {hasRealReviews && <ReviewShowcase reviews={shownReviews} stats={reviewStats} />}


          <div className={styles.reviewFormWrap}>
            <div>
              <h3 className={styles.reviewFormTitle}>Розкажіть, як усе пройшло</h3>
              <p className={styles.reviewFormText}>
                Відгуки лишають клієнти з акаунтом. Це найчесніший спосіб показати
                новим людям, чого чекати від сервісу.
              </p>
            </div>
            <ReviewForm />
          </div>
        </div>
      </section>

      {/* Поштою */}
      <section className="band" data-theme="dark">
        <div className={`${styles.bandArt} ${styles.bandArtRoutes}`} aria-hidden="true" />
        <div className={`container ${styles.block} ${styles.mail}`}>
          <div>
            <h2 className={styles.h2}>Не у Львові? Надішліть Новою Поштою</h2>
            <p className={styles.mailLead}>
              Діагностуємо, телефонуємо з ціною, ремонтуємо. Назад надсилаємо за свій кошт.
            </p>
            <Link href="/poshtoyu" className="btn btn-accent">
              Як надіслати
            </Link>
          </div>

          <ol className={styles.mailSteps}>
            {mailInSteps.map((s, i) => (
              <li key={s.no} className={styles.mailStep}>
                <span aria-hidden="true" className={styles.mailNo}>
                  {i + 1}
                </span>
                <span className={styles.mailText}>{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="band stripe-alt">
        <div className={`container ${styles.block} ${styles.faqSection}`}>
          <div>
            <h2 className={styles.h2}>Коротко про головне</h2>
            <FaqAside />
          </div>

          <div className={styles.faqList}>
            <Accordion items={faq} />
          </div>
        </div>
      </section>

      {/* Статус і запис — одна темна смуга перед підвалом */}
      <div className="band" data-theme="dark">
        <div className={styles.statusWrap}>
          <ParcelDecor />
          <StatusCheck />
        </div>

      {/* Запис */}
        <section id="book" className={`container ${styles.book}`}>
        <div className={styles.bookGrid}>
          <div className={styles.bookCopy}>
            <h2 className={styles.h2}>Опишіть проблему — відповімо до 25 хвилин</h2>
            <p className={styles.bookLead}>
              Достатньо моделі та кількох слів про симптом. Передзвонимо, скажемо орієнтовну ціну й
              термін.
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

              <div className={styles.contact}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span>Львів і Новий Розділ · адресу надсилаємо після запису</span>
              </div>
            </div>
          </div>

          <BookingForm
            source="landing"
            select={{ name: "model", label: "Модель", placeholder: "Оберіть модель", options: [...bookingModels] }}
            // На головній досить кількох слів — деталі зʼясуємо по телефону
            problemMax={150}
          />
        </div>
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
