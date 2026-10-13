"use client";

import { useState } from "react";
import Link from "next/link";
import { modelGroups, type Model, type ModelGroup } from "@/data/models";
import { site } from "@/data/site";
import styles from "./ModelGrid.module.css";

/**
 * Скільки карток показуємо за раз — решту відкриває кнопка. У розмітці лежать
 * усі: інакше на сторінки решти моделей не було б жодного посилання з розділу.
 */
const PAGE = 12;

export default function ModelGrid({
  models,
  /** Фільтри за поколінням мають сенс лише для iPhone */
  withGroups = false,
  searchPlaceholder = "Пошук моделі",
}: {
  models: Model[];
  withGroups?: boolean;
  searchPlaceholder?: string;
}) {
  const [filter, setFilter] = useState<ModelGroup | "all">("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const query = q.trim().toLowerCase();
  const matched = models.filter(
    (m) =>
      (!withGroups || filter === "all" || m.group === filter) &&
      (!query || m.name.toLowerCase().includes(query)),
  );

  const shown = Math.min(limit, matched.length);
  const rest = matched.length - shown;

  return (
    <section className={`container ${styles.section}`}>
      <div className={styles.controls}>
        {withGroups ? (
          <div className={styles.filters} role="group" aria-label="Фільтр моделей">
          {modelGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              className="chip"
              aria-pressed={filter === g.id}
              onClick={() => {
                setFilter(g.id);
                setLimit(PAGE);
              }}
            >
              {g.label}
            </button>
            ))}
          </div>
        ) : (
          <span className={styles.total}>{models.length} моделей</span>
        )}

        <div className={styles.search}>
          <label htmlFor="model-q" className="visually-hidden">
            Пошук моделі
          </label>
          <input
            id="model-q"
            type="search"
            className={styles.searchInput}
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(241,243,239,.5)" strokeWidth="1.5" strokeLinecap="round" className={styles.searchIcon} aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4 4" />
          </svg>
        </div>
      </div>

      <div className={styles.grid}>
        {matched.map((m, i) => (
          <Link key={m.slug} href={`/modeli/${m.slug}`} className={styles.card} hidden={i >= limit}>
            <span className={styles.media}>
              {m.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={m.image} alt="" className={styles.photo} loading="lazy" />
              ) : (
                <span className={styles.noPhoto} aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 5.5c2 0 3 1.4 3 3.5 0 2.5-1 6-1 8.5 0 1.4-.8 2.5-2.2 2.5S4 18.7 4 16.8c0-2.3.8-4.3.8-6.3C4.8 7.5 5.4 5.5 7 5.5z" />
                    <path d="M17 5.5c-2 0-3 1.4-3 3.5 0 2.5 1 6 1 8.5 0 1.4.8 2.5 2.2 2.5S20 18.7 20 16.8c0-2.3-.8-4.3-.8-6.3 0-3-.6-5-2.2-5z" />
                  </svg>
                </span>
              )}

            </span>

            <span className={styles.body}>
              <span className={styles.name}>{m.name}</span>
              <span className={styles.year}>{m.year}</span>

              <span className={styles.jobs}>
                {m.jobs.map((j) => (
                  <span key={j} className={styles.job}>
                    {j}
                  </span>
                ))}
              </span>

              <span className={styles.foot}>
                <span>{m.time}</span>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h13" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </span>
            </span>
          </Link>
        ))}
      </div>

      {rest > 0 && (
        <div className={styles.more}>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => setLimit((n) => n + PAGE)}>
            Показати ще {Math.min(rest, PAGE)}
          </button>
          <span className={styles.counter}>
            {shown} з {matched.length}
          </span>
        </div>
      )}

      {shown === 0 && (
        <div className={styles.empty}>
          Такої моделі в списку немає — але майже завжди беремо.{" "}
          <a href={site.phones[0].href}>Зателефонуйте</a>, скажемо одразу.
        </div>
      )}
    </section>
  );
}
