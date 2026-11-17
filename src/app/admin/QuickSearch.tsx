"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./QuickSearch.module.css";

/**
 * Швидкий пошук на Ctrl+K (на Mac — ⌘K) з будь-якого екрана адмінки.
 *
 * Поки що веде у «Заявки» з фільтром за введеним текстом. Групи результатів
 * (заявки, роботи, дії) і стрілки ↑↓ — окремим етапом (docs/admin-handoff, 3.4).
 */
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    onOpenChange(false);
    setQ("");
    router.push(text ? `/admin/zayavky?q=${encodeURIComponent(text)}` : "/admin/zayavky");
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label="Швидкий пошук"
      // Esc і клік повз вікно закривають його — стан тримаємо в синхроні
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <form onSubmit={submit} className={styles.box}>
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
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="№, ім'я, телефон, модель"
          autoComplete="off"
          autoFocus
        />
        <kbd className={styles.kbd}>Esc</kbd>
      </form>
      <p className={styles.hint}>Enter — шукати серед заявок</p>
    </dialog>
  );
}
