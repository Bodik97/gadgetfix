import type { Metadata } from "next";
import Link from "next/link";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";
import Accordion from "@/components/Accordion";
import BookingForm from "@/components/BookingForm";
import { site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Ремонт Android ${site.citiesIn}`,
  description: `Ремонт Android-смартфонів ${site.citiesIn}: спершу підбираємо запчастину під вашу модель, потім називаємо остаточну ціну й термін. Гарантія ${WARRANTY_MAX}, приймаємо й Новою Поштою.`,
  alternates: { canonical: "/android" },
};

const facts = [
  { value: "0", unit: "₴", note: "діагностика" },
  { value: "4", unit: "міс.", note: "гарантія на оригінальну деталь" },
  { value: "2", unit: "міс.", note: "гарантія на деталь-аналог" },
];

const steps = [
  { no: "01", title: "Заявка", body: "Пишете марку, модель і що сталося. Орієнтир по ціні кажемо одразу, якщо деталь типова." },
  { no: "02", title: "Підбір запчастини", body: "Шукаємо деталь у постачальників. Якщо модель рідкісна — знімаємо стару деталь і надсилаємо фото в магазин, щоб підібрали точно таку." },
  { no: "03", title: "Остаточна ціна", body: "Коли деталь знайдена, називаємо фінальну суму й термін. Далі вона не змінюється." },
  { no: "04", title: "Ремонт і перевірка", body: "Ставимо деталь, перевіряємо все перед видачею. Гарантія 2 місяці на аналог, 4 місяці на оригінал." },
];

const faq = [
  {
    q: "Чому не можна одразу сказати ціну?",
    a: "На Android сотні моделей, і навіть в одній моделі бувають різні версії дисплея чи шлейфа. Щоб не назвати ціну, яка потім зміниться, спершу знаходимо саме вашу деталь.",
  },
  {
    q: "Скільки триває підбір?",
    a: "Залежить від моделі: на популярні деталь знаходиться швидше, на рідкісні — поки магазин підбере її за фото й привезе. Термін кажемо, щойно він відомий.",
  },
  {
    q: "Які марки ремонтуєте?",
    a: "Беремо більшість Android-смартфонів. Напишіть модель — скажемо, чи можна знайти деталь.",
  },
  {
    q: "Можна надіслати Новою Поштою?",
    a: "Так, як і iPhone. Умови — на сторінці «Ремонт поштою».",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function AndroidPage() {
  return (
    <>
      {/* Герой */}
      <section className={`band ${styles.hero}`} data-theme="dark">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={`${styles.badge} nUp`}>
              <span className="pulse" />
              Не лише iPhone
            </span>

            <h1 className={`${styles.h1} nUp nUp-1`}>
              Ремонт Android-смартфонів
            </h1>

            <p className={`${styles.heroLead} nUp nUp-2`}>
              Запчастини на Android знайти складніше, ніж на iPhone. Тому спершу підбираємо деталь
              під вашу модель — і лише тоді кажемо остаточну ціну й термін.
            </p>

            <div className={`${styles.heroCta} nUp nUp-3`}>
              <Link href="#zayavka" className="btn btn-accent btn-lg btn-hero">
                Залишити заявку
              </Link>
              <a href={site.phones[0].href} className="btn btn-ghost btn-lg">
                {site.phones[0].label}
              </a>
            </div>
          </div>

          <div className={`${styles.heroSide} nUp nUp-2`}>
            <div className={styles.statsCard}>
              {facts.map((s, i) => (
                <div key={s.note} className={styles.statRow}>
                  {i > 0 && <span className={styles.divider} />}
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      <CountUp value={s.value} />
                    </span>
                    <span className={styles.statUnit}>{s.unit}</span>
                    <span className={styles.statNote}>{s.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="band stripe-alt">
      {/* Кроки */}
      <section className={`container ${styles.steps}`}>
        <h2 className={styles.stepsTitle}>Спершу деталь — потім ціна</h2>

        <div className={styles.stepGrid}>
          {steps.map((s, i) => (
            <Reveal key={s.no} delay={i * 110} className={styles.stepCell}>
              <article className={`card ${styles.step}`}>
                <div className={styles.stepNo}>{s.no}</div>
                <div className={styles.stepTitle}>{s.title}</div>
                <p className={styles.stepBody}>{s.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      </div>

      <div className="band" data-theme="dark">
      {/* Заявка */}
      <section id="zayavka" className={`container ${styles.send}`}>
        <div className={styles.sendGrid}>
          <div>
            <h2 className={styles.sendTitle}>Напишіть модель — пошукаємо деталь</h2>
            <p className={styles.sendLead}>
              Вкажіть у описі марку й модель телефона, наприклад «Samsung A54, розбитий екран».
              Передзвонимо, коли знатимемо, що деталь є і скільки коштує.
            </p>
          </div>

          <BookingForm source="model" model="Android" submitLabel="Надіслати заявку" />
        </div>
      </section>

      {/* FAQ */}
      <section className={`container ${styles.faqSection}`}>
        <div>
          <h2 className={styles.faqTitle}>Про ремонт Android</h2>
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
