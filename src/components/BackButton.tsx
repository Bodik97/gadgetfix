"use client";

import { useRouter } from "next/navigation";
import styles from "./BackButton.module.css";

type Props = {
  /** Куди вести, якщо історії немає — наприклад, коли сторінку відкрили з пошуку */
  fallback: string;
  label?: string;
  className?: string;
};

/**
 * Чи є куди повертатись у межах сайту. history.length цього не каже: він
 * більший за одиницю і тоді, коли людина прийшла з Google, — і «Назад»
 * повертало її в пошук.
 */
export function cameFromSite(): boolean {
  // Navigation API бачить лише записи нашого сайту: індекс 0 — перша наша сторінка у вкладці
  const entry = (window as unknown as { navigation?: { currentEntry?: { index: number } | null } }).navigation?.currentEntry;
  if (entry) return entry.index > 0;

  // Старіші браузери. Адреса змінилась без перезавантаження — отже, сайтом уже ходили
  const [loaded] = performance.getEntriesByType("navigation");
  if (loaded && new URL(loaded.name).pathname !== window.location.pathname) return true;

  // Сторінку відкрито напряму: дивимось, звідки прийшли
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    // Порожній referrer: закладка, месенджер, пошук із прихованим джерелом
    return false;
  }
}

export default function BackButton({ fallback, label = "Назад", className }: Props) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={`${styles.back} ${className ?? ""}`}
      aria-label={label}
      onClick={() => {
        // Перевіряємо в момент кліку, а не при рендері: інакше довелось би
        // тримати стан, якого на сервері ще немає
        if (cameFromSite()) router.back();
        else router.push(fallback);
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
