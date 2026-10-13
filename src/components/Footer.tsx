import Link from "next/link";
import Logo from "./Logo";
import { site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";
import styles from "./Footer.module.css";

/** Вміст <svg viewBox="0 0 24 24"> для іконок біля пунктів підвалу */
const icons = {
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  wrench: <path d="M14.5 6.5a4 4 0 0 0-5.2 5.2L4 17l3 3 5.3-5.3a4 4 0 0 0 5.2-5.2L15 12l-3-3z" />,
  iphone: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M10.5 6h3" /></>,
  ipad: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></>,
  watch: <><rect x="7" y="7" width="10" height="10" rx="3" /><path d="M9 7l.5-4h5l.5 4M9 17l.5 4h5l.5-4" /></>,
  android: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><circle cx="12" cy="6.5" r=".8" /></>,
  box: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /></>,
};

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg className={styles.icon} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

const serviceLinks = [
  { href: "/poslugy", label: "Послуги", icon: "wrench" },
  { href: "/modeli", label: "iPhone", icon: "iphone" },
  { href: "/planshety", label: "iPad", icon: "ipad" },
  { href: "/godynnyky", label: "Apple Watch", icon: "watch" },
  { href: "/android", label: "Android", icon: "android" },
  { href: "/poshtoyu", label: "Ремонт поштою", icon: "box" },
  { href: "/#book", label: "Запис", icon: "calendar" },
] as const;

export default function Footer() {
  return (
    <footer className={`stripe-alt ${styles.footer}`}>
      <div className={styles.grid}>
        <div>
          <Logo as="text" />
          <p className={styles.tagline}>{site.tagline}</p>
        </div>

        <div className={styles.col}>
          <div className={styles.colTitle}>Контакти</div>
          {site.phones.map((p) => (
            <a key={p.href} href={p.href} className={styles.link} data-track="footer-call">
              <Icon name="phone" />
              {p.label}
            </a>
          ))}
          <span className={`${styles.link} ${styles.muted}`}>
            <Icon name="clock" />
            {site.hours}
          </span>
        </div>

        <div className={styles.col}>
          <div className={styles.colTitle}>Написати</div>
          {site.messengers.map((m) => (
            <a
              key={m.label}
              href={m.href}
              className={styles.link}
              data-track={`footer-${m.label.toLowerCase()}`}
              {...(m.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}
            >
              <Icon name="chat" />
              {m.label}
            </a>
          ))}
        </div>

        <div className={styles.col}>
          <div className={styles.colTitle}>Сервіс</div>
          {serviceLinks.map((l) => (
            <Link key={l.href} href={l.href} className={styles.link}>
              <Icon name={l.icon} />
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span>
            © {new Date().getFullYear()} {site.name} · {site.cities.join(", ")}
          </span>
          <span className={styles.bottomLinks}>
            <Link href="/personalni-dani">Персональні дані</Link>
            <span aria-hidden="true">·</span>
            Гарантія {WARRANTY_MAX} на роботу
          </span>
        </div>
      </div>
    </footer>
  );
}
