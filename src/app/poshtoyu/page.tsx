import type { Metadata } from "next";
import Link from "next/link";
import CountUp from "@/components/CountUp";
import Accordion from "@/components/Accordion";
import MailInForm from "@/components/MailInForm";
import PackingList from "@/components/PackingList";
import StatusCheck from "@/components/StatusCheck";
import StepDeck from "@/components/StepDeck";
import { faq, heroStats, popular, steps } from "@/data/mailIn";
import HeroArt from "@/components/HeroArt";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Ремонт поштою — Нова Пошта по Україні",
  description:
    "Надішліть iPhone Новою Поштою з будь-якого міста: безкоштовна діагностика, фіксована ціна після дзвінка, повернення за наш кошт, гарантія до 4 місяців.",
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

export default function MailInPage() {
  return (
    <>
      {/* Герой */}
      <section className={`band ${styles.hero}`} data-theme="dark">
        <HeroArt name="route" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={`${styles.badge} nUp`}>
              <span className="pulse" />
              Приймаємо посилки з усієї України
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
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
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
      {/* Кроки */}
      <section className={`container ${styles.steps}`}>
        <h2 className={styles.stepsTitle}>Шість кроків від відправки до повернення</h2>

        <StepDeck steps={steps} />
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
              <span className={styles.popularPhoto} style={{ backgroundImage: `url("${p.img}")` }} />
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
                <span>Приймаємо посилки Пн–Сб до 18:00</span>
              </div>

              <div className={styles.note}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16v12H4z" />
                  <path d="M4 7l8 6 8-6" />
                </svg>
                <span>Пишемо у Viber, якщо так зручніше</span>
              </div>

              <div className={styles.note}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span>Оплата після ремонту — накладеним платежем</span>
              </div>
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

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </>
  );
}
