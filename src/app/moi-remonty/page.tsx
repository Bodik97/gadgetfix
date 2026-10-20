import type { Metadata } from "next";
import { Suspense } from "react";
import LiveRefresh from "@/components/LiveRefresh";
import Devices from "@/components/account/Devices";
import Guide from "@/components/account/Guide";
import NotifyToggle from "@/components/account/NotifyToggle";
import History from "@/components/account/History";
import QuickOrder from "@/components/account/QuickOrder";
import RepairCard from "@/components/account/RepairCard";
import CabinetBack from "@/components/account/CabinetBack";
import { plural } from "@/components/account/plural";
import { describeStatus, getClientLeads } from "@/db/leads";
import Link from "next/link";
import { getReviewsByUser, reviewTarget } from "@/db/reviews";
import { discountOffer } from "@/db/discounts";
import { getProfileExtras } from "@/lib/profile";
import { claimPendingLead } from "@/lib/leadClaim";
import ClaimedBanner from "@/components/account/ClaimedBanner";
import { getDevices, getEvents } from "@/db/events";
import { unreadByLead } from "@/db/messages";
import { getCabinetUser } from "@/lib/cabinetUser";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Мої ремонти",
  description: "Статус ремонту, посилка Новою Поштою, історія заявок і гарантія на ваші пристрої.",
  robots: { index: false, follow: false },
};

// Статус може змінитися будь-коли — кешувати не можна
export const dynamic = "force-dynamic";

const dateShort = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Kyiv",
});

export default async function MyRepairsPage() {
  // Маршрут закритий у middleware — сюди потрапляє лише авторизований клієнт
  const user = await getCabinetUser();
  const email = user?.email;

  // Заявку лишили без входу в цьому ж браузері — спершу переносимо її сюди
  const claimed = user ? await claimPendingLead(user.id, email ?? null) : null;

  const [leads, myReviews, extras] = await Promise.all([
    user ? getClientLeads(user.id, email) : Promise.resolve([]),
    user ? getReviewsByUser(user.id) : Promise.resolve([]),
    getProfileExtras(),
  ]);
  // Яка знижка чекає на нове замовлення, і телефон із профілю чи попередніх заявок — щоб не вводити вдруге
  const offer = discountOffer(leads, myReviews, extras.birthday)?.kind ?? null;
  const knownPhone = extras.phone ?? leads.find((l) => l.phone)?.phone ?? null;

  // Активних може бути кілька — раніше показувався лише перший
  const active = leads.filter((l) => describeStatus(l.status).active);
  const finished = leads.filter((l) => !describeStatus(l.status).active);

  const [eventsPerActive, userDevices, unread] = await Promise.all([
    Promise.all(active.map((l) => getEvents(l.id))),
    user ? getDevices(user.id) : Promise.resolve([]),
    unreadByLead(active.map((l) => l.id), "master"),
  ]);

  const rows = finished.map((l) => {
    const s = describeStatus(l.status);
    return {
      id: l.id,
      orderNo: l.orderNo,
      price: l.price,
      paid: Boolean(l.paidAt),
      what: l.model ?? l.service ?? "Ремонт",
      problem: l.problem,
      date: dateShort.format(l.createdAt),
      label: s.label,
      hint: s.hint,
      tone: s.tone,
      active: s.active,
      ttn: l.ttn,
    };
  });

  const waitingParcel = active.filter((l) => l.ttn).length;
  // Ремонти лише завершені й є про що писати — пропонуємо відгук за −10%
  const canReview = active.length === 0 && Boolean(reviewTarget(leads, myReviews)?.leadId);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <CabinetBack href="/kabinet" label="Кабінет" />
        </div>

        <h1 className={styles.h1}>Мої ремонти</h1>

        {leads.length > 0 && <LiveRefresh label="Статус оновлюється сам" withText />}
      </header>

      {claimed && <ClaimedBanner orderNo={claimed.orderNo} discount={claimed.discount} />}

      {/* Найголовніше — одразу під заголовком: що зараз відбувається з пристроєм */}
      {active.length > 0 && (
        <section className={styles.section} aria-labelledby="aktyvni" data-guide="stage">
          <div className={styles.sectionHead}>
            <h2 id="aktyvni" className={styles.h2}>
              {active.length === 1 ? "Зараз у роботі" : `Зараз у роботі · ${active.length}`}
            </h2>
            {waitingParcel > 0 && (
              <span className={styles.tag}>
                {waitingParcel} {plural(waitingParcel, "посилка", "посилки", "посилок")} в дорозі
              </span>
            )}
          </div>

          <div className={styles.cards}>
            {active.map((lead, i) => (
              <RepairCard
                key={lead.id}
                lead={lead}
                events={eventsPerActive[i] ?? []}
                unread={unread.get(lead.id) ?? 0}
                coach={i === 0}
              />
            ))}
          </div>

          {/* Сповіщення — одразу під ремонтом: саме про нього людина й хоче знати */}
          <NotifyToggle />
        </section>
      )}

      {/* Ремонти лише завершені — запрошуємо до відгуку, поки враження свіжі */}
      {canReview && (
        <Link href="/moi-znyzhky" className={styles.review}>
          <span className={styles.reviewPct}>−10%</span>
          <span>
            <strong>Як усе пройшло? Залиште відгук</strong>
            <span className={styles.reviewNote}>Додайте фото до і після — і отримаєте −10% на наступний ремонт.</span>
          </span>
        </Link>
      )}

      {/* Новачок чи нічого не в роботі — форма замовлення першою */}
      {active.length === 0 && (
        <section className={styles.section} aria-labelledby="zamovyty" data-guide="order">
          <h2 id="zamovyty" className={styles.h2}>
            {leads.length > 0 ? "Новий ремонт" : "Замовити ремонт"}
          </h2>
          {leads.length === 0 && (
            <p className={styles.hint}>Як це працює: заявка → дзвінок майстра → ремонт → забираєте готовий.</p>
          )}
          <Suspense fallback={null}>
            <QuickOrder compact offer={offer} knownPhone={knownPhone} />
          </Suspense>
        </section>
      )}

      {userDevices.length > 0 && (
        <section className={styles.section} aria-labelledby="garantiya" data-guide="warranty">
          <h2 id="garantiya" className={styles.h2}>
            Гарантія на пристрої
          </h2>
          <p className={styles.hint}>
            Несправність повторилась у гарантійний строк — напишіть або подзвоніть і назвіть номер
            замовлення: усунемо безкоштовно.
          </p>
          <Devices devices={userDevices} />
        </section>
      )}

      {rows.length > 0 && (
        <section className={styles.section} aria-labelledby="istoriya" data-guide="history">
          <h2 id="istoriya" className={styles.h2}>
            Завершені ремонти
          </h2>
          <p className={styles.hint}>Усе, що ми для вас ремонтували: що зроблено, коли й за скільки.</p>
          <History rows={rows} />
        </section>
      )}

      {/* Коли щось уже в роботі, ще одне замовлення — згорнуте, як додаткова дія */}
      {active.length > 0 && (
        <section className={styles.section}>
          <Suspense fallback={null}>
            <QuickOrder collapsed offer={offer} knownPhone={knownPhone} />
          </Suspense>
        </section>
      )}

      {/* Інструкція — внизу й згорнута: вона для тих, хто шукає «як тут що» */}
      {leads.length > 0 && <Guide collapsed />}
    </div>
  );
}
