import type { Metadata } from "next";
import Link from "next/link";
import CabinetBack from "@/components/account/CabinetBack";
import SetPassword from "@/components/account/SetPassword";
import SignOutButton from "@/components/account/SignOutButton";
import { plural } from "@/components/account/plural";
import { getReviewsByUser, reviewTarget } from "@/db/reviews";
import { discountOffer } from "@/db/discounts";
import { getProfileExtras } from "@/lib/profile";
import { describeStatus, getClientLeads } from "@/db/leads";
import { unreadByLead } from "@/db/messages";
import type { Lead } from "@/db/schema";
import { getCabinetUser } from "@/lib/cabinetUser";
import base from "../moi-remonty/page.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Кабінет",
  description: "Ваші ремонти й знижки в GadgetFix.",
  robots: { index: false, follow: false },
};

// Лічильники на кнопках змінюються будь-коли — кешувати не можна
export const dynamic = "force-dynamic";

/** Головна кабінету: дві кнопки — «Мої ремонти» і «Мої знижки», на кожній — коротко, що там */
export default async function CabinetPage() {
  // Маршрут закритий у proxy — сюди потрапляє лише авторизований клієнт
  const user = await getCabinetUser();
  const name = user?.name;
  const email = user?.email;

  const [leads, myReviews, extras] = await Promise.all([
    user ? getClientLeads(user.id, email) : Promise.resolve([]),
    user ? getReviewsByUser(user.id) : Promise.resolve([]),
    getProfileExtras(),
  ]);

  const active = leads.filter((l) => describeStatus(l.status).active);
  const unread = await unreadByLead(active.map((l) => l.id), "master");
  const unreadTotal = [...unread.values()].reduce((sum, n) => sum + n, 0);

  const repairsNote =
    active.length > 0
      ? `${active.length} ${plural(active.length, "ремонт", "ремонти", "ремонтів")} у роботі`
      : leads.length > 0
        ? "Зараз нічого не в роботі"
        : "Замовте перший ремонт";

  const hasDiscount = myReviews.some((r) => r.discountAt && !r.discountLeadId);
  // Знижка за реєстрацію — на перший ремонт: поки ремонтів немає, вона чекає
  const offer = discountOffer(leads, myReviews, extras.birthday);
  const welcome = offer?.kind === "signup";
  const birthdayNow = offer?.kind === "birthday";
  const pending = myReviews.some((r) => !r.published && r.leadId && r.beforePath && r.afterPath);
  const canEarn = Boolean(reviewTarget(leads, myReviews)?.leadId);
  const discountNote = birthdayNow
    ? "🎂 Зараз діє −10% до дня народження"
    : welcome
      ? "Є знижка 5% на перший ремонт"
      : hasDiscount
        ? "Є знижка 10% на наступний ремонт"
        : pending
          ? "Відгук на перевірці — знижка 10% слідом"
          : canEarn
            ? "Отримайте 10% за відгук"
            : "Знижка 10% за відгук після ремонту";

  const now = nextStep({ leads, active, unreadTotal, hasDiscount, canEarn });

  return (
    <div className={base.page}>
      <header className={base.head}>
        <div className={base.headTop}>
          <CabinetBack href="/" label="Головна" />
          <SignOutButton />
        </div>

        <h1 className={base.h1}>{name ? `Привіт, ${name}` : "Кабінет"}</h1>
        {email && <p className={base.who}>{email}</p>}
      </header>

      <SetPassword />

      {/* Одна найважливіша дія — щоб не шукати її по розділах */}
      {now && (
        <section className={now.hot ? styles.nowHot : styles.now} aria-label="Що зараз">
          <span className={styles.nowLabel}>Зараз</span>
          <p className={styles.nowTitle}>{now.title}</p>
          {now.note && <p className={styles.nowNote}>{now.note}</p>}
          <Link href={now.href} className={`btn ${now.hot ? "btn-accent" : "btn-ghost"} ${styles.nowButton}`}>
            {now.action}
          </Link>
        </section>
      )}

      <nav className={styles.tiles} aria-label="Розділи кабінету">
        <Link href="/moi-remonty" className={styles.tile}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
            </svg>
          </span>
          <span className={styles.tileTitle}>Мої ремонти</span>
          <span className={styles.tileNote}>{repairsNote}</span>
          {unreadTotal > 0 && (
            <span className={styles.badge}>
              {unreadTotal} {plural(unreadTotal, "нове повідомлення", "нові повідомлення", "нових повідомлень")}
            </span>
          )}
          <Arrow />
        </Link>

        <Link href="/moi-znyzhky" className={hasDiscount || welcome || birthdayNow ? styles.tileHot : styles.tile}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 5L5 19" />
              <circle cx="7" cy="7" r="2.5" />
              <circle cx="17" cy="17" r="2.5" />
            </svg>
          </span>
          <span className={styles.tileTitle}>Мої знижки</span>
          <span className={styles.tileNote}>{discountNote}</span>
          <Arrow />
        </Link>

        <Link href="/profil" className={styles.tile}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
            </svg>
          </span>
          <span className={styles.tileTitle}>Мій профіль</span>
          <span className={styles.tileNote}>
            {!extras.birthday
              ? "Вкажіть день народження — і отримаєте −10% у своє свято"
              : !extras.phone
                ? "Додайте телефон — не вводитимете щоразу"
                : "Фото, контакти й пароль"}
          </span>
          <Arrow />
        </Link>
      </nav>
    </div>
  );
}

type Step = { title: string; note?: string; action: string; href: string; hot: boolean };

/** Що клієнтові варто зробити першим — від найтерміновішого */
function nextStep({
  leads,
  active,
  unreadTotal,
  hasDiscount,
  canEarn,
}: {
  leads: Lead[];
  active: Lead[];
  unreadTotal: number;
  hasDiscount: boolean;
  canEarn: boolean;
}): Step | null {
  const what = (l: Lead) => l.model ?? "Ваш пристрій";

  if (unreadTotal > 0) {
    return {
      title: "Майстер відповів вам",
      note: `${unreadTotal} ${plural(unreadTotal, "нове повідомлення", "нові повідомлення", "нових повідомлень")} у чаті ремонту.`,
      action: "Відкрити чат",
      href: "/moi-remonty",
      hot: true,
    };
  }

  const ready = active.find((l) => l.status === "ready" && !l.deliveryRequested && !l.receivedAt);
  if (ready) {
    return {
      title: `${what(ready)} готовий`,
      note: "Оберіть, як забрати: у майстерні або Новою Поштою.",
      action: "Обрати",
      href: "/moi-remonty",
      hot: true,
    };
  }

  const shipped = active.find((l) => l.status === "shipped");
  if (shipped) {
    return {
      title: "Посилка вже їде до вас",
      note: shipped.ttn ? `ТТН ${shipped.ttn}` : undefined,
      action: "Деталі",
      href: "/moi-remonty",
      hot: false,
    };
  }

  if (hasDiscount) {
    return {
      title: "У вас знижка 10%",
      note: "Застосуємо її автоматично до наступного замовлення.",
      action: "Замовити ремонт",
      href: "/moi-remonty",
      hot: true,
    };
  }

  if (canEarn) {
    return {
      title: "Отримайте 10% на наступний ремонт",
      note: "Залиште відгук із фото до і після.",
      action: "Залишити відгук",
      href: "/moi-znyzhky",
      hot: false,
    };
  }

  const working = active[0];
  if (working) {
    const s = describeStatus(working.status);
    return {
      title: `${what(working)}: ${s.label.toLowerCase()}`,
      note: s.hint,
      action: "Деталі",
      href: "/moi-remonty",
      hot: false,
    };
  }

  if (leads.length === 0) {
    return {
      title: "Замовте перший ремонт зі знижкою 5%",
      note: "Знижка за реєстрацію вже ваша — залиште заявку, і майстер назве ціну з нею.",
      action: "Скористатись знижкою",
      href: "/moi-remonty?znyzhka=1",
      hot: true,
    };
  }

  return null;
}

function Arrow() {
  return (
    <svg className={styles.arrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
