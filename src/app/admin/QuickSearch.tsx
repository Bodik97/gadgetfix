"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { quickSearch, type SearchResult } from "./searchAction";
import styles from "./QuickSearch.module.css";

/**
 * Швидкий пошук на Ctrl+K (на Mac — ⌘K) з будь-якого екрана адмінки
 * (docs/admin-handoff/design/Search.dc.html).
 *
 * Групи: Заявки (№, імʼя, телефон, IMEI, модель), Роботи і ціни, Дії.
 * Клавіші: ↑ ↓ — вибрати, Enter — відкрити, Esc — закрити.
 */

type Item = { key: string; href: string | null; render: React.ReactNode; group: "Заявки" | "Роботи і ціни" | "Дії" };

export default function QuickSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<SearchResult | null>(null);
  const [active, setActive] = useState(0);

  // Клавіша K за кодом, а не за літерою: на українській розкладці це «л»
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Шукаємо, коли майстер на мить зупинився, а не на кожну літеру
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return;
    let stale = false;
    const t = setTimeout(async () => {
      const res = await quickSearch(text);
      if (!stale) {
        setFound(res);
        setActive(0);
      }
    }, 220);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  const text = q.trim();
  const result = text.length >= 2 ? found : null;
  const items: Item[] = [
    ...(result?.orders ?? []).map((o) => ({
      key: o.id,
      group: "Заявки" as const,
      href: `/admin/zayavky/${o.id}`,
      render: (
        <>
          <span className={styles.no}>{o.label}</span>
          <span className={styles.text}>
            <b>{o.who}</b> <span className={styles.muted}>· {o.what}</span>
          </span>
          <span className={styles.stage}>{o.stage}</span>
        </>
      ),
    })),
    ...(result?.prices ?? []).map((p) => ({
      key: `p-${p.title}-${p.online}`,
      group: "Роботи і ціни" as const,
      href: null,
      render: (
        <>
          <span className={styles.text}>
            {p.title}
            {p.online && <span className={styles.muted}> · магазин Онлайн</span>}
          </span>
          <b className={styles.price}>{p.price}</b>
        </>
      ),
    })),
    ...(text.length >= 2
      ? [
          {
            key: "a-new",
            group: "Дії" as const,
            href: `/admin/nova?model=${encodeURIComponent(text)}`,
            render: <span className={styles.text}>+ Нова заявка на «{text}»</span>,
          },
          {
            key: "a-list",
            group: "Дії" as const,
            href: `/admin/zayavky?q=${encodeURIComponent(text)}`,
            render: <span className={styles.text}>Усі заявки за «{text}» у списку</span>,
          },
        ]
      : []),
  ];
  const selectable = items.filter((i) => i.href);
  const current = selectable[Math.min(active, selectable.length - 1)];

  function close() {
    onOpenChange(false);
    setQ("");
    setFound(null);
  }

  function go(href: string | null) {
    if (!href) return;
    close();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, selectable.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(current?.href ?? null);
    }
  }

  let lastGroup = "";

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label="Швидкий пошук"
      // Esc і клік повз вікно закривають його — стан тримаємо в синхроні
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.box}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <label htmlFor="quick-search" className="visually-hidden">
          Пошук
        </label>
        <input
          id="quick-search"
          className={styles.input}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="№, імʼя, телефон, IMEI, модель"
          autoComplete="off"
          autoFocus
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="quick-results"
          aria-activedescendant={current ? `qs-${current.key}` : undefined}
        />
        <kbd className={styles.kbd}>Esc</kbd>
      </div>

      <div id="quick-results" role="listbox" className={styles.results}>
        {text.length >= 2 && result && result.orders.length === 0 && result.prices.length === 0 && (
          <p className={styles.empty}>Нічого не знайшли — можна завести нову заявку нижче.</p>
        )}
        {items.map((item) => {
          const head = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          const isActive = item === current;
          return (
            <div key={item.key}>
              {head && <p className={styles.group}>{head}</p>}
              {item.href ? (
                <a
                  id={`qs-${item.key}`}
                  role="option"
                  aria-selected={isActive}
                  href={item.href}
                  className={isActive ? styles.rowOn : styles.row}
                  onClick={(e) => {
                    e.preventDefault();
                    go(item.href);
                  }}
                  onMouseEnter={() => setActive(selectable.indexOf(item))}
                >
                  {item.render}
                  {isActive && <kbd className={styles.kbd}>Enter</kbd>}
                </a>
              ) : (
                <div className={styles.rowStatic}>{item.render}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.foot}>
        <span>↑ ↓ вибрати</span>
        <span>Enter відкрити</span>
        <span>Esc закрити</span>
      </div>
    </dialog>
  );
}
