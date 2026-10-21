import type { Metadata } from "next";
import Link from "next/link";
import CountUp from "@/components/CountUp";
import Accordion from "@/components/Accordion";
import MailInForm from "@/components/MailInForm";
import PackingList from "@/components/PackingList";
import StatusCheck from "@/components/StatusCheck";
import StepDeck from "@/components/StepDeck";
import { delivery, faq, heroStats, popular, steps } from "@/data/mailIn";
import HeroArt from "@/components/HeroArt";
import Ticker from "@/components/Ticker";
import { tickerItems } from "@/data/servicesPage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Ремонт поштою — Нова Пошта по Україні",
  description:
    "Надішліть iPhone Новою Поштою з будь-якого міста: безкоштовна діагностика при ремонті, фіксована ціна після дзвінка, повернення за наш кошт, гарантія до 4 місяців.",
  alternates: { canonical: "/poshtoyu" },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

/** Власні лінійні іконки доставки — малюються червоним Нової Пошти (currentColor) */
const deliveryIcons: Record<(typeof delivery)[number]["icon"], React.ReactNode> = {
  // Відділення: будиночок із дверима
  branch: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V9.5L12 4l7 5.5V21" />
      <path d="M9.5 21v-5.5h5V21" />
      <path d="M9 11h6" />
    </>
  ),
  // Вантажівка
  courier: (
    <>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 9.5h4l3 3v3h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  // Накладна зі штрихкодом
  ttn: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M8 7.5v6M10.5 7.5v6M13 7.5v6M16 7.5v6" />
      <path d="M8 17h8" />
    </>
  ),
  // Щит із галочкою
  insurance: (
    <>
      <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // Купюра
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  // Посилка зі стрілкою повернення
  free: (
    <>
      <path d="M3 8l9-4 9 4v8l-9 4-9-4z" />
      <path d="M3 8l9 4 9-4M12 12v8" />
      <path d="M16.5 4.5l-3 1.5" />
    </>
  ),
};

export default function MailInPage() {
  return (
    // Червоний Нової Пошти — лише в тому, що про доставку; кнопки дій лишаються салатовими
    <div className={styles.np}>
      {/* Герой */}
      <section className={`band ${styles.hero}`} data-theme="dark">
        <HeroArt name="route" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={`${styles.npBadge} nUp`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- векторний SVG, оптимізатор картинок тут нічого не дасть */}
              <img src="/brand/nova-poshta.svg" alt="Нова Пошта" width={191} height={42} />
              <span>Доставка по всій Україні</span>
            </span>

            <h1 className={`${styles.h1} nUp nUp-1`}>
              Ремонт поштою — без поїздки до Львова
            </h1>

            <p className={`${styles.heroLead} nUp nUp-2`}>
              Надсилаєте Новою Поштою — діагностуємо, телефонуємо з фіксованою ціною, ремонтуємо і
              повертаємо за свій кошт.
            </p>

            <div className={`${styles.heroCta} nUp nUp-3`}>
              <Link href="#send" className="btn btn-accent btn-lg btn-hero">
                Оформити відправку
              </Link>
              <Link href="#track" className="btn btn-ghost btn-lg">
                Де моя посилка
              </Link>
            </div>
          </div>

          <div className={`${styles.heroSide} nUp nUp-2`}>
            <div className={styles.statsCard}>
              {heroStats.map((s, i) => (
                <div key={s.note} className={styles.statRow}>
                  {i > 0 && <span className={styles.divider} />}
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      <CountUp value={s.value} />
                    </span>
                    <span className={styles.statUnit}>{s.unit.trim()}</span>
                    <span className={styles.statNote}>{s.note}</span>
                  </div>
                </div>
              ))}
            </div>

            <div aria-hidden="true" className={styles.tracker}>
              <span className={`${styles.parcel} anim-roll`}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--np-red)" }} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
                  <path d="M3 7l9 4 9-4" />
                  <path d="M12 11v10" />
                </svg>
              </span>
              <div className={styles.trackerBody}>
                <div className={styles.trackerLabel}>Ваша посилка в дорозі</div>
                <div className={styles.trackerBar}>
                  <div className={`${styles.trackerFill} anim-grow`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="band stripe-alt">
        <Ticker items={tickerItems} />
      {/* Кроки */}
      <section className={`container ${styles.steps}`}>
        <h2 className={styles.stepsTitle}>Шість кроків від відправки до повернення</h2>

        <StepDeck steps={steps} />
      </section>

      {/* Доставка Новою Поштою — що доступно, з іконками */}
      <section className={`container ${styles.delivery}`}>
        <div className={styles.deliveryHead}>
          {/* eslint-disable-next-line @next/next/no-img-element -- векторний SVG */}
          <img src="/brand/nova-poshta.svg" alt="Нова Пошта" width={191} height={42} loading="lazy" className={styles.deliveryLogo} />
          <h2 className={styles.deliveryTitle}>Можливості доставки</h2>
        </div>

        <ul className={styles.deliveryGrid}>
          {delivery.map((d) => (
            <li key={d.icon} className={styles.deliveryCard}>
              <span className={styles.deliveryIcon} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {deliveryIcons[d.icon]}
                </svg>
              </span>
              <h3 className={styles.deliveryCardTitle}>{d.title}</h3>
              <p className={styles.deliveryText}>{d.text}</p>
            </li>
          ))}
        </ul>
      </section>

      </div>

      {/* Пам'ятка */}
      <section className={`band ${styles.packing}`} data-theme="dark">
        <div className={`container ${styles.packingGrid}`}>
          <div>
            <h2 className={styles.packingTitle}>Як спакувати, щоб доїхало цілим</h2>
            <p className={styles.packingLead}>
              Відмітьте пункти — це той самий список, який ми диктуємо телефоном.
            </p>
          </div>

          <PackingList />
        </div>
      </section>

      <div className="band stripe-alt">
      {/* Популярні моделі */}
      <section className={`container ${styles.popular}`}>
        <div className={styles.popularHead}>
          <div>
            <h2 className={styles.popularTitle}>Оберіть модель — і одразу до деталей</h2>
          </div>
          <Link href="/modeli" className={styles.allLink}>
            Весь каталог
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h13" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        <div className={styles.popularGrid}>
          {popular.map((p) => (
            <Link key={p.name} href={`/modeli/${p.slug}`} className={styles.popularCard}>
              {p.img ? (
                <span className={styles.popularPhoto} style={{ backgroundImage: `url("${p.img}")` }} />
              ) : (
                <span className={styles.popularNoPhoto} aria-hidden="true">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="2.5" width="12" height="19" rx="2.6" />
                    <path d="M10.5 5h3" />
                  </svg>
                </span>
              )}
              <span className={styles.popularVeil} />
              <span className={styles.popularName}>{p.name}</span>
            </Link>
          ))}
        </div>
      </section>

      </div>

      <div className="band" data-theme="dark">
      <StatusCheck
        id="track"
        title="Де моя посилка"
        lead="Введіть номер замовлення та останні 4 цифри свого телефону — покажемо, на якому етапі ремонт. Номер називає майстер, коли передзвонює; він також є у вашому кабінеті."
      />

      {/* Оформлення */}
      <section id="send" className={`container ${styles.send}`}>
        <div className={styles.sendGrid}>
          <div>
            <h2 className={styles.sendTitle}>Заповніть — надішлемо адресу відділення</h2>
            <p className={styles.sendLead}>
              Після заявки передзвонюємо й називаємо адресу, отримувача і номер замовлення. Далі просто
              віддаєте пакунок на пошту.
            </p>

            <div className={styles.notes}>
              <div className={styles.note}>
                {/* Посилка */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--np-red)" }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
                  <path d="M3 7l9 4 9-4" />
                  <path d="M12 11v10" />
                </svg>
                <span>Приймаємо посилки Пн–Сб до 18:00</span>
              </div>

              <div className={styles.note}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--np-red)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16v12H4z" />
                  <path d="M4 7l8 6 8-6" />
                </svg>
                <span>Пишемо у Viber, якщо так зручніше</span>
              </div>

              <div className={styles.note}>
                {/* Купюра — накладений платіж */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--np-red)" }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2.5" y="6" width="19" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2.6" />
                  <path d="M6 9.5v5M18 9.5v5" />
                </svg>
                <span>Оплата після ремонту — накладеним платежем</span>
              </div>
            </div>

            <div className={styles.npLine}>
              {/* eslint-disable-next-line @next/next/no-img-element -- векторний SVG */}
              <img src="/brand/nova-poshta.svg" alt="Нова Пошта" width={191} height={42} loading="lazy" />
              <span>Відправка й повернення — Новою Поштою</span>
            </div>
          </div>

          <MailInForm />
        </div>
      </section>

      {/* FAQ */}
      <section className={`container ${styles.faqSection}`}>
        <div>
          <h2 className={styles.faqTitle}>Про доставку й оплату</h2>
        </div>
        <div className={styles.faqList}>
          <Accordion items={faq} />
        </div>
      </section>
      </div>

      <p className={`container ${styles.npDisclaimer}`}>
        «Нова Пошта» — торговельна марка її власника. GadgetFix користується її доставкою як клієнт і не є
        представником Нової Пошти.
      </p>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </div>
  );
}
