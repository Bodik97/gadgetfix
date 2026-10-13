import type { Metadata } from "next";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import BackButton from "@/components/BackButton";
import LiveRefresh from "@/components/LiveRefresh";
import Devices from "@/components/account/Devices";
import Guide from "@/components/account/Guide";
import History from "@/components/account/History";
import QuickOrder from "@/components/account/QuickOrder";
import RepairCard from "@/components/account/RepairCard";
import SetPassword from "@/components/account/SetPassword";
import SignOutButton from "@/components/account/SignOutButton";
import { plural } from "@/components/account/plural";
import { describeStatus, getClientLeads } from "@/db/leads";
import { getDevices, getEvents } from "@/db/events";
import { unreadByLead } from "@/db/messages";
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
  const user = await currentUser();
  const name = user?.firstName?.trim();
  const email = user?.primaryEmailAddress?.emailAddress;

  const leads = user ? await getClientLeads(user.id, email) : [];

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

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <BackButton fallback="/" />
          <SignOutButton />
        </div>

        <h1 className={styles.h1}>Мої ремонти</h1>

        <LiveRefresh label="Статус оновлюється сам" />

        <p className={styles.who}>
          {name ? <strong>{name}</strong> : null}
          {name && email ? " · " : null}
          {email}
        </p>
      </header>

      <SetPassword />

      <Guide />

      {/* Найголовніше — вгорі: що зараз відбувається з пристроєм */}
      {active.length > 0 ? (
        <section className={styles.section} aria-labelledby="aktyvni">
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
          <p className={styles.hint}>
            Етап оновлюється сам. Є питання — кнопка «Написати майстру» в картці.
          </p>

          <div className={styles.cards}>
            {active.map((lead, i) => (
              <RepairCard
                key={lead.id}
                lead={lead}
                events={eventsPerActive[i] ?? []}
                unread={unread.get(lead.id) ?? 0}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.section} aria-labelledby="zamovyty">
          <h2 id="zamovyty" className={styles.h2}>
            {leads.length > 0 ? "Зараз нічого не в роботі" : "Замовити ремонт"}
          </h2>
          <Suspense fallback={null}>
            <QuickOrder compact />
          </Suspense>
        </section>
      )}

      {userDevices.length > 0 && (
        <section className={styles.section} aria-labelledby="garantiya">
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
        <section className={styles.section} aria-labelledby="istoriya">
          <h2 id="istoriya" className={styles.h2}>
            Завершені ремонти
          </h2>
          <p className={styles.hint}>Усе, що ми для вас ремонтували: що зроблено, коли й за скільки.</p>
          <History rows={rows} />
        </section>
      )}

      {/* Коли щось уже в роботі, форма лишається внизу — як додаткова дія */}
      {active.length > 0 && (
        <section className={styles.section}>
          <Suspense fallback={null}>
            <QuickOrder />
          </Suspense>
        </section>
      )}
    </div>
  );
}
