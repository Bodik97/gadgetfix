import type { Metadata } from "next";
import Link from "next/link";
import CabinetBack from "@/components/account/CabinetBack";
import SetPassword from "@/components/account/SetPassword";
import NotifyToggle from "@/components/account/NotifyToggle";
import RepairSteps from "@/components/account/RepairSteps";
import SignOutButton from "@/components/account/SignOutButton";
import { plural } from "@/components/account/plural";
import { getReviewsByUser, reviewTarget } from "@/db/reviews";
import { discountOffer, type DiscountOffer } from "@/db/discounts";
import { DISCOUNT_PERCENT } from "@/data/discounts";
import { getProfileExtras } from "@/lib/profile";
import { claimPendingLead } from "@/lib/leadClaim";
import ClaimedBanner from "@/components/account/ClaimedBanner";
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

/**
 * Головна кабінету. Одна велика картка «що зараз» з єдиною яскравою кнопкою,
 * під нею рядок про знижку, два розділи й тихі нагадування внизу — щоб головне
 * не губилось серед другорядного.
 */
export default async function CabinetPage() {
  // Маршрут закритий у proxy — сюди потрапляє лише авторизований клієнт
  const user = await getCabinetUser();
  const name = user?.name;
  const email = user?.email;

  // Заявку лишили без входу в цьому ж браузері — спершу переносимо її сюди
  const claimed = user ? await claimPendingLead(user.id, email ?? null) : null;

  const [leads, myReviews, extras] = await Promise.all([
    user ? getClientLeads(user.id, email) : Promise.resolve([]),
    user ? getReviewsByUser(user.id) : Promise.resolve([]),
    getProfileExtras(),
  ]);

  const active = leads.filter((l) => describeStatus(l.status).active);
  const unread = await unreadByLead(active.map((l) => l.id), "master");

  const offer = discountOffer(leads, myReviews, extras.birthday);
  const pending = myReviews.some((r) => !r.published && r.leadId && r.beforePath && r.afterPath);
  const canEarn = Boolean(reviewTarget(leads, myReviews)?.leadId);

  const now = nextStep({ leads, active, unread, offer, canEarn });
  const focus = now.lead ? describeStatus(now.lead.status) : null;
  // Картка вже про знижку — другий раз під нею не повторюємо
  const discount = now.about === "discount" ? null : discountLine(offer, pending, canEarn);

  return (
    <div className={base.page}>
      <header className={base.head}>
        <div className={base.headTop}>
          <CabinetBack href="/" label="Головна" />
        </div>

        <div className={styles.hello}>
          {/* Фото веде в профіль: там його й змінюють; без фото — перша літера й підказка */}
          <Link href="/profil" className={styles.avatar} aria-label={extras.image ? "Мій профіль" : "Додати фото в профілі"}>
            {extras.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- фото з Clerk, свій CDN
              <img src={extras.image} alt="" />
            ) : (
              <span>{(name || email || "?")[0].toUpperCase()}</span>
            )}
          </Link>
          <div className={styles.helloText}>
            <h1 className={base.h1}>{name ? `Привіт, ${name}` : "Кабінет"}</h1>
            <p className={styles.helloHint}>Тут видно, що з вашим гаджетом, можна написати майстру й забрати знижки.</p>
          </div>
        </div>
      </header>

      {claimed && <ClaimedBanner orderNo={claimed.orderNo} discount={claimed.discount} />}

      {/* Одна найважливіша дія — єдина яскрава кнопка на екрані */}
      <section className={styles.now} aria-label="Що зараз">
        <span className={styles.nowLabel}>{now.lead ? `Ремонт №${now.lead.orderNo}` : "Зараз"}</span>
        <p className={styles.nowTitle}>{now.title}</p>
        {focus && <RepairSteps status={focus} />}
        {now.note && <p className={styles.nowNote}>{now.note}</p>}
        <div className={styles.nowActions}>
          <Link href={now.href} className={`btn btn-accent ${styles.nowButton}`}>
            {now.action}
          </Link>
          {leads.length > 0 && now.href !== "/moi-remonty" && (
            <Link href="/moi-remonty" className={styles.more}>
              Усі ремонти й гарантія →
            </Link>
          )}
        </div>
        {active.length > 1 && (
          <p className={styles.nowMore}>
            І ще {active.length - 1} {plural(active.length - 1, "ремонт", "ремонти", "ремонтів")} у роботі — усі в «Мої ремонти».
          </p>
        )}
      </section>

      {discount && (
        <Link href="/moi-znyzhky" className={styles.discount}>
          <span className={styles.discountIcon} aria-hidden="true">
            {discount.icon}
          </span>
          <span>
            <strong>{discount.title}</strong>
            <span className={styles.discountNote}>{discount.note}</span>
          </span>
          <Arrow />
        </Link>
      )}

      <nav className={styles.tiles} aria-label="Розділи кабінету">
        <Link href="/moi-remonty" className={styles.tile}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
            </svg>
          </span>
          <span className={styles.tileText}>
            <span className={styles.tileTitle}>Мої ремонти</span>
            <span className={styles.tileNote}>Етапи, чат із майстром, гарантія</span>
          </span>
          <Arrow />
        </Link>

        <Link href="/moi-znyzhky" className={styles.tile}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 5L5 19" />
              <circle cx="7" cy="7" r="2.5" />
              <circle cx="17" cy="17" r="2.5" />
            </svg>
          </span>
          <span className={styles.tileText}>
            <span className={styles.tileTitle}>Мої знижки</span>
            <span className={styles.tileNote}>Що діє і як отримати більше</span>
          </span>
          <Arrow />
        </Link>

        <Link href="/profil" className={styles.tile}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
            </svg>
          </span>
          <span className={styles.tileText}>
            <span className={styles.tileTitle}>Мій профіль</span>
            <span className={styles.tileNote}>
              {!extras.birthday ? "Вкажіть день народження — −10% у ваше свято" : "Фото, телефон, пароль"}
            </span>
          </span>
          <Arrow />
        </Link>
      </nav>

      {/* Тихі нагадування — корисні, але не головні */}
      <div className={styles.extras}>
        {active.length > 0 && <NotifyToggle />}
        <SetPassword />
      </div>

      <footer className={styles.foot}>
        <SignOutButton quiet />
      </footer>
    </div>
  );
}

type Step = {
  title: string;
  note?: string;
  action: string;
  href: string;
  /** Ремонт, про який картка: над нею номер і шкала етапів */
  lead?: Lead;
  /** Картка про знижку — рядок про знижку під нею вже зайвий */
  about?: "discount";
};

/** Що клієнтові варто зробити першим — від найтерміновішого */
function nextStep({
  leads,
  active,
  unread,
  offer,
  canEarn,
}: {
  leads: Lead[];
  active: Lead[];
  unread: Map<string, number>;
  offer: DiscountOffer;
  canEarn: boolean;
}): Step {
  const what = (l: Lead) => l.model ?? l.service ?? "Ваш пристрій";

  const chat = active.find((l) => (unread.get(l.id) ?? 0) > 0);
  if (chat) {
    const n = unread.get(chat.id) ?? 0;
    return {
      title: "Майстер відповів вам",
      note: `${n} ${plural(n, "нове повідомлення", "нові повідомлення", "нових повідомлень")} у чаті ремонту.`,
      action: "Відкрити чат",
      href: "/moi-remonty",
      lead: chat,
    };
  }

  // Без передоплати деталь не замовляють — ремонт стоїть
  const toPay = active.find((l) => l.prepayment !== null && !l.prepaidAt && !l.paidAt);
  if (toPay) {
    return {
      title: `Чекаємо передоплату — ${toPay.prepayment?.toLocaleString("uk-UA")} ₴`,
      note: "Оплачуєте лише деталь. Щойно гроші надійдуть — замовимо її й продовжимо ремонт.",
      action: "Як оплатити",
      href: "/moi-remonty",
      lead: toPay,
    };
  }

  const ready = active.find((l) => l.status === "ready" && !l.deliveryRequested && !l.receivedAt);
  if (ready) {
    return {
      title: `${what(ready)} готовий!`,
      note: "Оберіть, як забрати: у майстерні або Новою Поштою.",
      action: "Обрати, як забрати",
      href: "/moi-remonty",
      lead: ready,
    };
  }

  const packing = active.find((l) => l.status === "ready" && l.deliveryRequested && !l.ttn);
  if (packing) {
    return {
      title: "Готуємо посилку",
      note: "Щойно відправимо — тут з'явиться номер накладної Нової Пошти.",
      action: "Деталі ремонту",
      href: "/moi-remonty",
      lead: packing,
    };
  }

  const shipped = active.find((l) => l.status === "shipped");
  if (shipped) {
    return {
      title: "Посилка вже їде до вас",
      note: shipped.ttn ? `Накладна Нової Пошти: ${shipped.ttn}` : undefined,
      action: "Деталі ремонту",
      href: "/moi-remonty",
      lead: shipped,
    };
  }

  const working = active[0];
  if (working) {
    const s = describeStatus(working.status);
    return {
      title: `${what(working)}: ${s.label.toLowerCase()}`,
      note: `${s.hint} Етап оновлюється сам — дзвонити не треба.`,
      action: "Деталі й чат із майстром",
      href: "/moi-remonty",
      lead: working,
    };
  }

  if (offer?.kind === "signup") {
    return {
      title: `Замовте перший ремонт зі знижкою ${DISCOUNT_PERCENT.signup}%`,
      note: "Знижка за реєстрацію вже ваша — залиште заявку, і майстер назве ціну з нею.",
      action: "Скористатись знижкою",
      href: "/moi-remonty?znyzhka=1",
      about: "discount",
    };
  }

  if (offer) {
    return {
      title: offer.kind === "birthday" ? "З днем народження! −10% уже діє 🎂" : "У вас знижка 10% за відгук",
      note: "Застосуємо її автоматично до наступного замовлення.",
      action: "Замовити ремонт",
      href: "/moi-remonty?zamovyty=1",
      about: "discount",
    };
  }

  if (canEarn) {
    return {
      title: "Отримайте −10% на наступний ремонт",
      note: "Розкажіть, як усе пройшло, і додайте фото до і після.",
      action: "Залишити відгук",
      href: "/moi-znyzhky",
      about: "discount",
    };
  }

  return {
    title: leads.length > 0 ? "Зараз нічого не в роботі" : "Замовте перший ремонт",
    note: "Залиште заявку — передзвонимо, підкажемо ціну й термін.",
    action: "Замовити ремонт",
    href: "/moi-remonty?zamovyty=1",
  };
}

/** Рядок «Ваша знижка» — лише та, що справді спрацює: на замовлення діє одна */
function discountLine(
  offer: DiscountOffer,
  pending: boolean,
  canEarn: boolean,
): { icon: string; title: string; note: string } | null {
  const one = "На одне замовлення діє одна знижка.";
  if (offer?.kind === "birthday") return { icon: "🎂", title: "−10% до дня народження", note: `Спрацює сама на наступне замовлення. ${one}` };
  if (offer?.kind === "review") return { icon: "🎁", title: "−10% за ваш відгук", note: `Спрацює сама на наступне замовлення. ${one}` };
  if (offer?.kind === "signup") return { icon: "🎁", title: "−5% на перший ремонт", note: "Натисніть «Скористатись» у формі замовлення." };
  if (pending) return { icon: "⏳", title: "Відгук на перевірці", note: "Щойно опублікуємо — отримаєте −10% на наступний ремонт." };
  if (canEarn) return { icon: "🎁", title: "−10% за відгук", note: "Розкажіть, як усе пройшло, і додайте фото до і після." };
  return null;
}

function Arrow() {
  return (
    <svg className={styles.arrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
