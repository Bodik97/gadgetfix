import type { Metadata } from "next";
import CabinetBack from "@/components/account/CabinetBack";
import SignOutButton from "@/components/account/SignOutButton";
import ReviewForm from "@/components/ReviewForm";
import { getReviewsByUser, reviewTarget } from "@/db/reviews";
import { getClientLeads } from "@/db/leads";
import { getCabinetUser } from "@/lib/cabinetUser";
import base from "../moi-remonty/page.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Мої знижки",
  description: "Знижка 15% за відгук із фото до і після ремонту.",
  robots: { index: false, follow: false },
};

// Знижку нараховує майстер будь-коли — кешувати не можна
export const dynamic = "force-dynamic";

const dateShort = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Kyiv",
});

/**
 * Знижки клієнта. Окремої таблиці знижок немає: 15% нараховують за відгук
 * із фото до і після про виданий ремонт — тож усе читаємо з відгуків.
 */
export default async function MyDiscountsPage() {
  // Маршрут закритий у proxy — сюди потрапляє лише авторизований клієнт
  const user = await getCabinetUser();
  const email = user?.email;

  const [leads, myReviews] = await Promise.all([
    user ? getClientLeads(user.id, email) : Promise.resolve([]),
    user ? getReviewsByUser(user.id) : Promise.resolve([]),
  ]);

  const ready = myReviews.filter((r) => r.discountAt && !r.discountLeadId);
  const used = myReviews.filter((r) => r.discountLeadId);
  const pending = myReviews.filter((r) => !r.published && r.leadId && r.beforePath && r.afterPath);

  // Відгук пишуть про виданий ремонт — лише такий дає знижку
  const found = reviewTarget(leads, myReviews);
  const target = found?.leadId ? found : undefined;
  const targetLead = leads.find((l) => l.id === target?.leadId);

  return (
    <div className={base.page}>
      <header className={base.head}>
        <div className={base.headTop}>
          <CabinetBack href="/kabinet" label="Кабінет" />
          <SignOutButton />
        </div>
        <h1 className={base.h1}>Мої знижки</h1>
      </header>

      <section className={base.section} aria-labelledby="aktyvni">
        <h2 id="aktyvni" className={base.h2}>
          Активні
        </h2>
        {ready.length > 0 ? (
          ready.map((r) => (
            <div key={r.id} className={styles.discount}>
              <span className={styles.percent}>−15%</span>
              <span className={styles.discountText}>
                <strong>На наступний ремонт</strong>
                <span>
                  Нараховано {r.discountAt ? dateShort.format(r.discountAt) : ""}. Майстер врахує знижку в&nbsp;ціні&nbsp;— нічого
                  вводити не треба.
                </span>
              </span>
            </div>
          ))
        ) : (
          <p className={base.hint}>
            {pending.length > 0
              ? "Ваш відгук на перевірці. Щойно опублікуємо — тут з’явиться знижка 15%."
              : "Зараз активних знижок немає."}
          </p>
        )}
      </section>

      <section className={base.section} aria-labelledby="yak">
        <h2 id="yak" className={base.h2}>
          Як отримати 15%
        </h2>
        <ol className={styles.steps}>
          <li>Відремонтуйте пристрій у&nbsp;нас і&nbsp;заберіть його.</li>
          <li>Напишіть відгук і&nbsp;додайте фото пристрою до і&nbsp;після ремонту.</li>
          <li>Після перевірки відгуку отримаєте знижку 15% на&nbsp;наступний ремонт.</li>
        </ol>

        {target ? (
          <>
            <p className={base.hint}>
              Розкажіть, як пройшов ремонт{targetLead?.model ? ` ${targetLead.model}` : ""}:
            </p>
            <ReviewForm leadId={target.leadId ?? undefined} />
          </>
        ) : (
          <p className={base.hint}>
            {leads.length > 0
              ? "Форма відгуку з’явиться тут, щойно майстер видасть пристрій."
              : "Форма відгуку з’явиться тут після першого ремонту."}
          </p>
        )}
      </section>

      {used.length > 0 && (
        <section className={base.section} aria-labelledby="vykorystani">
          <h2 id="vykorystani" className={base.h2}>
            Використані
          </h2>
          <ul className={styles.used}>
            {used.map((r) => (
              <li key={r.id}>
                <span>Знижка 15%</span>
                <span className={styles.usedNote}>
                  {r.discountAt ? `нараховано ${dateShort.format(r.discountAt)}` : "використано"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
