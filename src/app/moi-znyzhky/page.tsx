import type { Metadata } from "next";
import Link from "next/link";
import CabinetBack from "@/components/account/CabinetBack";
import ReviewForm from "@/components/ReviewForm";
import { getReviewsByUser, reviewTarget } from "@/db/reviews";
import { describeStatus, getClientLeads } from "@/db/leads";
import { discountOffer } from "@/db/discounts";
import { getProfileExtras } from "@/lib/profile";
import { DISCOUNT_PERCENT, DISCOUNT_REASON } from "@/data/discounts";
import { getCabinetUser } from "@/lib/cabinetUser";
import base from "../moi-remonty/page.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Мої знижки",
  description: "Знижка 5% на перший ремонт за реєстрацію і 10% за відгук із фото до і після.",
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
 * Знижки клієнта. Окремої таблиці знижок немає: 5% за реєстрацію діє, поки
 * ремонтів ще не було, а 10% нараховують за відгук із фото до і після про
 * виданий ремонт — тож усе читаємо із заявок і відгуків.
 */
export default async function MyDiscountsPage() {
  // Маршрут закритий у proxy — сюди потрапляє лише авторизований клієнт
  const user = await getCabinetUser();
  const email = user?.email;

  const [leads, myReviews, extras] = await Promise.all([
    user ? getClientLeads(user.id, email) : Promise.resolve([]),
    user ? getReviewsByUser(user.id) : Promise.resolve([]),
    getProfileExtras(),
  ]);

  const ready = myReviews.filter((r) => r.discountAt && !r.discountLeadId);
  // Знижка, закріплена за заявкою (відхилена заявка її повертає): у роботі — ще «діє», після — «використана»
  const withDiscount = leads.filter((l) => l.discount && l.status !== "rejected");
  const inWork = withDiscount.filter((l) => describeStatus(l.status).active);
  const used = withDiscount.filter((l) => !describeStatus(l.status).active);
  const pending = myReviews.filter((r) => !r.published && r.leadId && r.beforePath && r.afterPath);
  const offer = discountOffer(leads, myReviews, extras.birthday);
  const welcome = offer?.kind === "signup";
  const birthdayNow = offer?.kind === "birthday";

  // Відгук пишуть про виданий ремонт — лише такий дає знижку
  const found = reviewTarget(leads, myReviews);
  const target = found?.leadId ? found : undefined;
  const targetLead = leads.find((l) => l.id === target?.leadId);

  return (
    <div className={base.page}>
      <header className={base.head}>
        <div className={base.headTop}>
          <CabinetBack href="/kabinet" label="Кабінет" />
        </div>
        <h1 className={base.h1}>Мої знижки</h1>
      </header>

      <section className={base.section} aria-labelledby="aktyvni">
        <h2 id="aktyvni" className={base.h2}>
          Ваші знижки
        </h2>
        <p className={base.hint}>На одне замовлення діє одна знижка. Нічого вводити не треба — майстер назве ціну вже з нею.</p>
        {inWork.map((l) => (
          <div key={l.id} className={styles.discountOn}>
            <span className={styles.percent}>−{l.discount ? DISCOUNT_PERCENT[l.discount] : ""}%</span>
            <span className={styles.discountText}>
              <strong>✓ Застосовано до замовлення №{l.orderNo}</strong>
              <span>
                Знижка {l.discount ? DISCOUNT_REASON[l.discount] : ""}. Майстер назве ціну вже з нею.
              </span>
            </span>
          </div>
        ))}
        {birthdayNow && (
          <div className={styles.discount}>
            <span className={styles.percent}>−10%</span>
            <span className={styles.discountText}>
              <strong>З днем народження! 🎂</strong>
              <span>Цього тижня знижка діє сама — застосуємо її до замовлення автоматично.</span>
              <Link href="/moi-remonty" className={`btn btn-accent ${styles.use}`}>
                Замовити ремонт зі знижкою
              </Link>
            </span>
          </div>
        )}
        {welcome && (
          <div className={styles.discount}>
            <span className={styles.percent}>−5%</span>
            <span className={styles.discountText}>
              <strong>На перший ремонт — за реєстрацію</strong>
              <span>Натисніть — і знижка застосується до вашого замовлення.</span>
              <Link href="/moi-remonty?znyzhka=1" className={`btn btn-accent ${styles.use}`}>
                Скористатись знижкою 5%
              </Link>
            </span>
          </div>
        )}
        {ready.length > 0 ? (
          ready.map((r) => (
            <div key={r.id} className={styles.discount}>
              <span className={styles.percent}>−10%</span>
              <span className={styles.discountText}>
                <strong>На наступний ремонт</strong>
                <span>
                  Нараховано {r.discountAt ? dateShort.format(r.discountAt) : ""}. Застосуємо автоматично до наступного
                  замовлення&nbsp;— нічого натискати не треба.
                </span>
                <Link href="/moi-remonty" className={`btn btn-accent ${styles.use}`}>
                  Замовити ремонт зі знижкою
                </Link>
              </span>
            </div>
          ))
        ) : pending.length > 0 ? (
          <p className={base.hint}>Ваш відгук на перевірці. Щойно опублікуємо — тут з’явиться знижка 10%.</p>
        ) : (
          !welcome &&
          !birthdayNow &&
          inWork.length === 0 && (
            <p className={styles.empty}>Поки знижок немає — але їх легко отримати. Ось як 👇</p>
          )
        )}
      </section>

      {!extras.birthday && (
        <section className={base.section} aria-labelledby="den-narodzhennia">
          <h2 id="den-narodzhennia" className={base.h2}>
            −10% у ваш день народження
          </h2>
          <p className={base.hint}>
            Вкажіть дату в профілі — і тиждень до та після свята знижка діятиме на будь-який ремонт сама.
          </p>
          <Link href="/profil" className={`btn btn-ghost ${styles.use}`}>
            Вказати день народження
          </Link>
        </section>
      )}

      <section className={base.section} aria-labelledby="yak">
        <h2 id="yak" className={base.h2}>
          −10% за відгук
        </h2>
        <ol className={styles.steps}>
          <li>Відремонтуйте пристрій у&nbsp;нас і&nbsp;заберіть його.</li>
          <li>Напишіть відгук і&nbsp;додайте фото пристрою до і&nbsp;після ремонту.</li>
          <li>Після перевірки відгуку отримаєте знижку 10% на&nbsp;наступний ремонт.</li>
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
            {used.map((l) => (
              <li key={l.id}>
                <span>
                  Знижка {l.discount ? `${DISCOUNT_PERCENT[l.discount]}% ${DISCOUNT_REASON[l.discount]}` : ""}
                </span>
                <span className={styles.usedNote}>у замовленні №{l.orderNo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
