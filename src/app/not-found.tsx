import type { Metadata } from "next";
import Link from "next/link";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Сторінку не знайдено",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <section className="band" data-theme="dark">
      <div className={`container ${styles.box}`}>
        <span className={styles.code}>404</span>
        <h1 className={styles.h1}>Такої сторінки немає</h1>
        <p className={styles.lead}>
          Можливо, адреса змінилась або в посиланні помилка. Ось звідки зручно почати.
        </p>

        <div className={styles.links}>
          <Link href="/poslugy" className="btn btn-accent btn-lg">
            Послуги й ціни
          </Link>
          <Link href="/modeli" className="btn btn-ghost btn-lg">
            Моделі iPhone
          </Link>
          <Link href="/" className="btn btn-ghost btn-lg">
            На головну
          </Link>
        </div>
      </div>
    </section>
  );
}
