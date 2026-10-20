"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./LiveRefresh.module.css";

/**
 * Як часто питаємо сервер, чи щось змінилось.
 *
 * Вісім секунд відчувались як гальмування: майстер виставляв статус, а
 * клієнт ще півхвилини дивився на старий. Три секунди читаються як «одразу»,
 * а навантаження лишається мізерним — запит короткий, і його не роблять
 * у фоновій вкладці.
 */
const POLL_MS = 3_000;

/**
 * Тримає сторінку свіжою без участі людини.
 *
 * Майстер виставив статус — клієнт бачить це сам, не знаючи, що таке
 * «оновити сторінку». Питаємо короткий відбиток стану і, якщо він змінився,
 * робимо м'яке оновлення: воно перемальовує дані й лишає прокрутку на місці.
 */
/** withText — підпис лишається й на телефоні: у кабінеті одна крапка без слів схожа на помилку */
export default function LiveRefresh({ label, silent, withText }: { label?: string; silent?: boolean; withText?: boolean }) {
  const router = useRouter();
  const seen = useRef<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);

  const check = useCallback(async () => {
    // Фонова вкладка нічого не показує — не смикаємо сервер марно
    if (document.hidden) return;

    // Поки людина щось вписує, оновлення почекає: воно могло б скинути
    // введене в полі, якого ще не зберегли
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;

    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;

      const { version } = (await res.json()) as { version: string | null };
      if (!version) return;

      if (seen.current === null) {
        seen.current = version;
        return;
      }

      if (seen.current !== version) {
        seen.current = version;
        router.refresh();
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 3500);
      }
    } catch {
      // Зв'язок пропав — просто спробуємо наступного разу
    }
  }, [router]);

  useEffect(() => {
    const id = setInterval(check, POLL_MS);

    // Повернулись на вкладку — перевіряємо одразу, не чекаючи таймера
    const onVisible = () => !document.hidden && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  // У майстра значок лише заважав у робочій панелі: оновлення й так помітне
  // по самих даних. Клієнту ж напис потрібен — він пояснює, чому цифри
  // змінюються самі.
  if (silent) return null;

  return (
    <div className={withText ? `${styles.wrap} ${styles.withText}` : styles.wrap} role="status" aria-live="polite">
      {justUpdated ? (
        <span className={styles.updated}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          <span className={styles.text}>Оновлено</span>
        </span>
      ) : (
        <span className={styles.live}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.text}>{label ?? "Оновлюється саме"}</span>
        </span>
      )}
    </div>
  );
}
