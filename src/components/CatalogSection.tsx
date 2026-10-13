import Link from "next/link";
import ModelGrid from "./ModelGrid";
import Ticker from "./Ticker";
import { sections, type Section } from "@/data/catalog";
import styles from "./CatalogSection.module.css";

const tickerItems = [
  "Акумулятори з ємністю 100%",
  "Гарантія до 4 місяців",
  "Діагностика безкоштовна",
  "Екран і акумулятор — до 2 днів",
];

export default function CatalogSection({ section }: { section: Section }) {
  return (
    <>
      <section className={`band ${styles.hero}`} data-theme="dark">
        <div className={styles.heroInner}>
          <span className={`${styles.badge} nUp`}>
            <span className="pulse" />
            {section.models.length} моделей · діагностика безкоштовна
          </span>

          <h1 className={`${styles.h1} nUp nUp-1`}>{section.title}</h1>
          <p className={`${styles.heroLead} nUp nUp-2`}>{section.lead}</p>

          {/* Розділи каталогу — щоб перемикатись, не повертаючись у меню */}
          <nav className={`${styles.tabs} nUp nUp-3`} aria-label="Розділи каталогу">
            {sections.map((s) => {
              const active = s.kind === section.kind;
              return (
                <Link
                  key={s.kind}
                  href={s.href}
                  className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                  aria-current={active ? "page" : undefined}
                >
                  {s.tab}
                  <span className={styles.tabCount}>{s.models.length}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <div className="band stripe-alt">
      <Ticker items={tickerItems.map((label) => ({ label }))} />

      <ModelGrid
        models={section.models}
        withGroups={section.kind === "iphone"}
        searchPlaceholder={
          section.kind === "iphone"
            ? "Пошук: 13 Pro, XR, SE…"
            : section.kind === "ipad"
              ? "Пошук: Air, mini, Pro…"
              : "Пошук: Series 8, SE, Ultra…"
        }
      />
      </div>

      <div className="band" data-theme="dark">
      <section className={`container ${styles.cta}`}>
        <div className={styles.ctaBox}>
          <div>
            <h2 className={styles.ctaTitle}>Не бачите своєї моделі?</h2>
            <p className={styles.ctaLead}>
              Напишіть модель і симптом — відповімо за 25 хвилин, разом із орієнтиром по ціні й
              терміну.
            </p>
          </div>

          <div className={styles.ctaButtons}>
            <Link href="/#book" className="btn btn-accent btn-lg btn-hero">
              Написати нам
            </Link>
            <Link href="/poshtoyu" className="btn btn-ghost btn-lg">
              Надіслати поштою
            </Link>
          </div>
        </div>
      </section>
      </div>
    </>
  );
}
