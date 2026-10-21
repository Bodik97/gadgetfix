"use client";

import { useState } from "react";
import Link from "next/link";
import { boardPrices, PRICES_PUBLISHED, uah, type ModelPrice } from "@/data/prices";
import styles from "./ModelJobs.module.css";

// Face ID і True Tone згадуємо лише там, де вони є: в iPhone з кнопкою Home їх немає
const partNote = {
  original: {
    faceId: "Оригінальні дисплеї: рідна кольоропередача, True Tone і Face ID працюють без застережень. Дорожче, але поводиться як заводський.",
    plain: "Оригінальні дисплеї: рідна кольоропередача. Дорожче, але поводиться як заводський.",
  },
  analog: `Якісні аналоги дисплеїв: перевірені постачальники, гарантія 2\u00A0місяці (на\u00A0оригінал\u00A0—\u00A04). Дешевше, кольори трохи інші при максимальній яскравості.`,
};

const screenBody = {
  original: {
    faceId: "Оригінальний дисплей, перенесення рідного Face ID, перевірка True Tone.",
    plain: "Оригінальний дисплей, перевірка сенсора перед видачею.",
  },
  analog: {
    faceId: "Якісний аналог дисплея від перевіреного постачальника, перенесення Face ID, перевірка сенсора.",
    plain: "Якісний аналог дисплея від перевіреного постачальника, перевірка сенсора.",
  },
};

/**
 * Роботи після екрана. Заголовок — разом із моделлю: «Заміна акумулятора
 * iPhone 13». time: null — термін моделі з каталогу.
 */
const restJobs = [
  { slug: "akumuliator", title: (m: string) => `Заміна акумулятора ${m}`, body: "Новий АКБ, показуємо ємність до та після. Циклів — 0.", time: null },
  { slug: "roziem-zariadzhannia", title: (m: string) => `Ремонт роз'єму заряджання ${m}`, body: "Спершу чистка — часто цього достатньо. Якщо ні, міняємо шлейф.", time: "від 40 хв" },
  { slug: "kamera", title: (m: string) => `Ремонт камери ${m}`, body: "Мутне фото, пил під склом, не працює автофокус — модуль або лише скло.", time: null },
  { slug: "dynamik-i-mikrofon", title: (m: string) => `Ремонт динаміка і мікрофона ${m}`, body: "Вас не чують або звук хрипить — спершу чистимо сітки, заміна вже потім.", time: null },
  { slug: "korpus", title: (m: string) => `Заміна корпусу і задньої кришки ${m}`, body: "Тріщини на склі спинки або погнута рамка — ставимо нове скло чи корпус.", time: null },
  { slug: "knopky-y-vibro", title: (m: string) => `Ремонт кнопок і вібро ${m}`, body: "Не працює гучність, залипає бокова кнопка, зникла вібрація — міняємо шлейф або модуль.", time: null },
  { slug: "zalyv-vodoiu", title: (m: string) => `${m} після заливу водою`, body: "Діагностика: дивимось, що постраждало, і чесно кажемо, чи візьмемось. Безкоштовна, якщо беремося за ремонт.", time: "діагностика безкоштовна при ремонті" },
  { slug: "ne-vmykaietsia", title: (m: string) => `${m} не вмикається`, body: "Перевіряємо акумулятор, екран і роз'єм; якщо справа в платі — скажемо прямо.", time: "діагностика безкоштовна при ремонті" },
];

const boardFrom = new Map(boardPrices.map((b) => [b.slug, b.from]));

export default function ModelJobs({
  prices,
  name,
  /** Термін моделі з каталогу: «до 2 днів», «1–2 дні» */
  time,
  /** Чи є в моделі Face ID і True Tone — від цього залежать тексти про екран */
  faceId,
}: {
  prices?: ModelPrice;
  name: string;
  time: string;
  faceId: boolean;
}) {
  const [part, setPart] = useState<"original" | "analog">("analog");
  const kind = faceId ? "faceId" : "plain";

  // Перемикач має сенс лише там, де деталь буває двох рівнів — тобто де є екран
  const screen = prices?.["zamina-ekrana"];
  const tiered = typeof screen === "object";

  /** Ціна роботи так, як її треба показати: точна сума або «від» */
  function priceOf(slug: string): { text: string; exact: boolean } | null {
    const board = boardFrom.get(slug);
    if (board !== undefined) return { text: uah(board), exact: false };

    const value = prices?.[slug as keyof ModelPrice];
    if (value === undefined) return null;
    if (typeof value === "number") return { text: uah(value), exact: true };
    return { text: uah(value[part]), exact: true };
  }

  // Роботи без ціни для цієї моделі не показуємо: у годинника немає ні камери,
  // ні роз'єму, і порожній рядок поруч із цінами читався б як «ціну приховали».
  const jobs = [
    { slug: "zamina-ekrana", title: (m: string) => `Заміна екрана ${m}`, body: tiered ? screenBody[part][kind] : "Нове скло або модуль у зборі, з відновленням герметизації.", time: null },
    ...restJobs,
  ].filter((j) => priceOf(j.slug) !== null);

  return (
    <section className={`container ${styles.section}`}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{PRICES_PUBLISHED ? `Ціни на ремонт ${name}` : `Що робимо для ${name}`}</h2>
        </div>

        {tiered && (
          <div className={styles.toggle} role="group" aria-label="Тип запчастини">
            <button
              type="button"
              className={part === "original" ? styles.tabActive : styles.tab}
              aria-pressed={part === "original"}
              onClick={() => setPart("original")}
            >
              Оригінал
            </button>
            <button
              type="button"
              className={part === "analog" ? styles.tabActive : styles.tab}
              aria-pressed={part === "analog"}
              onClick={() => setPart("analog")}
            >
              Аналог
            </button>
          </div>
        )}
      </div>

      {tiered && (
        <p className={styles.note}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 7.5h.01" />
          </svg>
          <span>{part === "original" ? partNote.original[kind] : partNote.analog}</span>
        </p>
      )}

      <div className={styles.list}>
        {jobs.map((j) => {
          const price = priceOf(j.slug);

          return (
            <div key={j.slug} className={styles.job}>
              <h3 className={styles.jobTitle}>
                <Link href={`/poslugy/${j.slug}`}>
                  {/* Назва моделі не рветься: «Pro» не лишається сам на рядку */}
                  {j.title(name.replace(/ /g, "\u00A0"))}
                </Link>
              </h3>
              <div className={styles.jobBody}>{j.body}</div>

              <div className={styles.jobFoot}>
                <span className={styles.jobTime}>{j.time ?? time}</span>
                {PRICES_PUBLISHED && price && (
                  <span className={price.exact ? styles.price : styles.priceFrom}>
                    {!price.exact && "від "}
                    {price.text}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className={styles.priceNote}>
        {PRICES_PUBLISHED
          ? "Ціни під ключ — робота разом із деталлю. Точну суму називаємо після безкоштовної діагностики, і далі вона вже не змінюється. Ремонт іде за передоплатою: після погодження ціни ви вносите передоплату за деталь, решту — при видачі."
          : "Ціну називаємо після безкоштовної діагностики — і далі вона вже не змінюється. Ремонт іде за передоплатою за деталь, решта при видачі."}
      </p>
    </section>
  );
}
