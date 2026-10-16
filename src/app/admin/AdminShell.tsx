"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { usePathname } from "next/navigation";
import styles from "./AdminShell.module.css";

export type NavBadges = { fresh: number; toShip: number; pendingReviews: number };

const items = [
  {
    href: "/admin",
    label: "Огляд",
    badge: null,
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    href: "/admin/zayavky",
    label: "Заявки",
    badge: "fresh",
    icon: (
      <>
        <path d="M4 4.5h16v15H4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </>
    ),
  },
  {
    href: "/admin/arhiv",
    label: "Архів",
    badge: null,
    icon: (
      <>
        <rect x="3" y="4" width="18" height="4.5" rx="1" />
        <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" />
        <path d="M10 12.5h4" />
      </>
    ),
  },
  {
    href: "/admin/sklad",
    label: "Склад",
    badge: null,
    icon: (
      <>
        <path d="M4 8.5L12 4l8 4.5v7L12 20l-8-4.5z" />
        <path d="M4 8.5l8 4.5 8-4.5" />
        <path d="M12 13v7" />
      </>
    ),
  },
  {
    href: "/admin/kliyenty",
    label: "Клієнти",
    badge: null,
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </>
    ),
  },
  {
    href: "/admin/vidhuky",
    label: "Відгуки",
    badge: "pendingReviews",
    icon: (
      <>
        <path d="M4 5h16v11H9l-5 4z" />
        <path d="M9 10h6" />
      </>
    ),
  },
  {
    href: "/admin/roboty",
    label: "Роботи",
    badge: null,
    icon: (
      <>
        <rect x="3" y="5" width="8" height="14" rx="1.5" />
        <rect x="13" y="5" width="8" height="14" rx="1.5" />
      </>
    ),
  },
  {
    href: "/admin/groshi",
    label: "Каса",
    badge: null,
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
  {
    href: "/admin/statystyka",
    label: "Статистика",
    badge: null,
    icon: (
      <>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </>
    ),
  },
] as const;

function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

const STORAGE_KEY = "gadgetfix-admin-nav";

/**
 * Згорнутість меню живе в localStorage, а не в стані React: її треба пам'ятати
 * між заходами, а на сервері цього значення ще немає. useSyncExternalStore
 * робить читання безпечним для гідрації — до першого рендера на клієнті
 * меню вважається розгорнутим.
 */
let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    // Приватне вікно або заблоковані куки — лишаємо розгорнутим
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "collapsed" : "open");
  } catch {
    // Не змогли запам'ятати — не біда, стан діє до кінця сеансу
  }
  for (const l of listeners) l();
}

export default function AdminShell({
  badges,
  master,
  actions,
  signOut,
  children,
}: {
  badges: NavBadges;
  /** Імʼя майстра, який зайшов — щоб було видно, під ким відкрита адмінка */
  master: string;
  /** Живе оновлення — приходить із серверного layout */
  actions: React.ReactNode;
  /** Server action виходу: кнопка є і в панелі, і в шухляді на телефоні */
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  // Шухляда на телефоні — окремий стан, вона завжди починається закритою
  const [drawer, setDrawer] = useState(false);

  const toggle = useCallback(() => writeCollapsed(!collapsed), [collapsed]);

  return (
    <div className={`container ${styles.shell}`}>
      {drawer && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Закрити меню"
          onClick={() => setDrawer(false)}
        />
      )}

      <nav
        id="admin-nav"
        className={`${styles.nav} ${collapsed ? styles.collapsed : ""} ${drawer ? styles.open : ""}`}
        aria-label="Розділи адміністрування"
      >
        <div className={styles.navHead}>
          <span className={styles.navTitle}>Розділи</span>

          <button
            type="button"
            className={styles.toggle}
            onClick={toggle}
            aria-expanded={!collapsed}
            title={collapsed ? "Розгорнути меню" : "Згорнути меню"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
            </svg>
            <span className="visually-hidden">
              {collapsed ? "Розгорнути меню" : "Згорнути меню"}
            </span>
          </button>

          <button
            type="button"
            className={styles.close}
            onClick={() => setDrawer(false)}
            aria-label="Закрити меню"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <ul className={styles.list}>
          {items.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const n = item.badge ? badges[item.badge] : 0;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={active ? styles.linkActive : styles.link}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setDrawer(false)}
                >
                  <svg
                    className={styles.icon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </svg>

                  <span className={styles.label}>{item.label}</span>
                  {n > 0 && <span className={styles.badge}>{n}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* У шухляді на телефоні вихід — помітною кнопкою під розділами */}
        <form action={signOut} className={styles.drawerSignOut}>
          <button type="submit" className="btn btn-accent">
            <SignOutIcon />
            Вийти
          </button>
        </form>
      </nav>

      <div className={styles.content}>
        <div className={styles.topbar}>
          {/* Шапки сайту в адмінці немає — логотип на широкому екрані живе тут */}
          <span className={styles.brand}>
            <Logo />
          </span>

          <span className={styles.who} title={`Ви увійшли як ${master}`}>
            <span className={styles.whoMark} aria-hidden="true">
              {master.slice(0, 1).toUpperCase()}
            </span>
            <span className={styles.whoName}>{master}</span>
          </span>

          {pathname !== "/admin" && (
            <BackButton fallback="/admin" className={styles.back} />
          )}

          <span className={styles.spacer} />

          {actions}

          <ThemeToggle className={styles.theme} />

          <form action={signOut}>
            <button type="submit" className={styles.signOut} aria-label="Вийти">
              <SignOutIcon />
              <span className={styles.signOutLabel}>Вийти</span>
            </button>
          </form>

          {/* Кнопка шухляди видима лише на вузькому екрані — у правому куті */}
          <button
            type="button"
            className={styles.drawerButton}
            aria-expanded={drawer}
            aria-controls="admin-nav"
            aria-label="Меню"
            onClick={() => setDrawer(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
