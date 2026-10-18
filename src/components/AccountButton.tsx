"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { openSignIn, prepareSignIn, useAuthState } from "./auth/authStore";
import styles from "./AccountButton.module.css";

function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

const SEEN_KEY = "gf-unread-seen";

/** Скільки повідомлень майстра клієнт ще не прочитав — питаємо раз на пів хвилини */
function useUnread(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  // Кількість, про яку клієнт уже бачив плашку й закрив її
  const [seen, setSeen] = useState(() =>
    typeof window === "undefined" ? 0 : Number(sessionStorage.getItem(SEEN_KEY) ?? 0),
  );

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    const check = async () => {
      // Фонова вкладка нічого не показує — не смикаємо сервер марно
      if (document.hidden) return;
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok || stopped) return;

        const n = ((await res.json()) as { unread?: number }).unread ?? 0;
        setUnread(n);
        // Усе прочитано — наступне повідомлення знову покаже плашку
        if (n === 0) {
          sessionStorage.removeItem(SEEN_KEY);
          setSeen(0);
        }
      } catch {
        // Зв'язок пропав — спробуємо наступного разу
      }
    };

    check();
    const timer = setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled]);

  const dismiss = () => {
    sessionStorage.setItem(SEEN_KEY, String(unread));
    setSeen(unread);
  };

  return { unread, fresh: unread > 0 && unread !== seen, dismiss };
}

export default function AccountButton() {
  const { isSignedIn, isLoaded } = useAuthState();
  const pathname = usePathname();
  const { unread, fresh, dismiss } = useUnread(Boolean(isSignedIn));

  // Поки стан невідомий (сервер, або Clerk ще вантажиться для того, хто увійшов),
  // тримаємо місце тієї ж ширини — інакше шапка
  // смикнеться, коли стан приїде
  if (!isLoaded) {
    return <span className={styles.placeholder} aria-hidden="true" />;
  }

  if (isSignedIn) {
    return (
      <>
        <Link
          href="/kabinet"
          className={styles.button}
          aria-label={unread > 0 ? `Кабінет, непрочитаних повідомлень: ${unread}` : "Кабінет"}
        >
          <UserIcon />
          <span className={styles.label}>Кабінет</span>
          {unread > 0 && <span className={styles.badge}>{unread > 9 ? "9+" : unread}</span>}
        </Link>

        {/* На сторінці ремонтів чат і так перед очима — плашка там зайва */}
        {fresh && !pathname.startsWith("/moi-remonty") && (
          <div className={styles.toast} role="status">
            <span className={styles.toastText}>
              Майстер відповів вам
              {unread > 1 ? ` — ${unread} нових повідомлень` : ""}
            </span>
            <Link href="/moi-remonty" className="btn btn-accent" onClick={dismiss}>
              Відкрити чат
            </Link>
            <button type="button" className={styles.toastClose} onClick={dismiss} aria-label="Закрити">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    // Clerk починає вантажитись, щойно курсор чи фокус на кнопці, — до натискання
    <button
      type="button"
      className={styles.button}
      onClick={openSignIn}
      onPointerEnter={prepareSignIn}
      onFocus={prepareSignIn}
      aria-label="Вхід"
      data-track="login"
    >
      <UserIcon />
      <span className={styles.label}>Вхід</span>
    </button>
  );
}
