import Link from "next/link";
import type { Lead, LeadEvent } from "@/db/schema";
import Chat from "@/components/Chat";
import { ARCHIVED, describeStatus } from "@/db/leads";
import MoneyFields from "./MoneyFields";
import NoteField from "./NoteField";
import DeleteLead from "./DeleteLead";
import LeadCardFrame from "./LeadCardFrame";
import QuickActions from "./QuickActions";
import StatusSelect from "./StatusSelect";
import TtnField from "./TtnField";
import WarrantyField from "./WarrantyField";
import { guessWarrantyDays, warrantyActive } from "@/data/warranty";
import AssignButton from "./AssignButton";
import { applyReviewDiscount } from "./actions";
import styles from "./page.module.css";

/** Хто зараз в адмінці і як звати кожного майстра за поштою */
export type Team = { me: string; names: Record<string, string> };

const sourceLabel: Record<string, string> = {
  landing: "головна",
  model: "модель",
  services: "послуги",
  "mail-in": "поштою",
  manual: "вручну",
};

/** Колір картки за статусом; закриті заявки — однаково сірі */
const statusClass: Record<Lead["status"], string> = {
  new: styles.statusNew,
  in_progress: styles.statusInProgress,
  ready: styles.statusReady,
  shipped: styles.statusShipped,
  done: styles.statusClosed,
  rejected: styles.statusClosed,
};

const dayFormat = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Kyiv" });

const dateFormat = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

export default function LeadCard({
  lead: r,
  events,
  unread = 0,
  orders = 1,
  priceHint = null,
  defaultOpen = false,
  telegram = null,
  discount = null,
  team,
}: {
  lead: Lead;
  events: LeadEvent[];
  /** Непрочитані від клієнта — майстер має бачити, що на нього чекають */
  unread?: number;
  /** Скільки всього звернень з цього номера, разом із цим */
  orders?: number;
  /** Скільки брали за цю ж роботу на цій же моделі раніше */
  priceHint?: { count: number; last: number; min: number; max: number } | null;
  /** Відкрити розгорнутою — коли майстер прийшов сюди із сигналу */
  defaultOpen?: boolean;
  /** Чи підключив клієнт бота зі статусами; null — бот не налаштований, позначки немає */
  telegram?: boolean | null;
  /** Знижка 15% за відгук: чекає, щоб її врахували, або вже врахована в цій заявці */
  discount?: { reviewId: string; applied: boolean } | null;
  /** Хто дивиться і як звати майстрів — щоб показати, хто взяв заявку */
  team: Team;
}) {
  const s = describeStatus(r.status);
  const mine = r.assignee === team.me;
  // Закрита заявка вже нічия в роботі — лишається лише памʼять, хто її робив
  const closed = ARCHIVED.includes(r.status);
  // Закрита відправки вже не чекає, навіть якщо клієнт колись її просив
  const waitingShip = r.deliveryRequested && !r.ttn && !closed;
  const assigneeName = r.assignee ? (team.names[r.assignee] ?? r.assignee.split("@")[0]) : null;

  return (
    <LeadCardFrame
      defaultOpen={defaultOpen}
      className={`${styles.card} ${styles.cardTone} ${statusClass[r.status]} ${waitingShip ? styles.cardShip : ""}`}
      summary={
        <>
          <div className={styles.cardTop}>
            {/* Номер, який клієнт диктує по телефону — тримаємо першим */}
            <span className={styles.orderNo}>№&#8202;{r.orderNo}</span>
            <span className={styles.name}>{r.name}</span>
            {r.clerkUserId ? (
              <span className={styles.tagAccount} title="Має акаунт — бачить статус у себе на сторінці">
                акаунт
              </span>
            ) : (
              <span className={styles.tagAnon} title="Без акаунта — пішло в Telegram">
                анонім
              </span>
            )}
            {orders > 1 && r.phone && (
              <Link
                href={`/admin/zayavky?q=${encodeURIComponent(r.phone)}`}
                className={styles.tagRepeat}
                title="Цей номер звертався раніше — показати всі його заявки"
              >
                {orders}-е звернення
              </Link>
            )}
            {telegram !== null &&
              (telegram ? (
                <span className={styles.tagAccount} title="Клієнт підключив бота — статуси приходять йому в Telegram">
                  Telegram
                </span>
              ) : (
                <span className={styles.tagAnon} title="Бота не підключено — про зміну статусу клієнт сам не дізнається, варто подзвонити">
                  без Telegram
                </span>
              ))}
            {assigneeName &&
              (mine ? (
                <span className={styles.tagMine}>ваша</span>
              ) : (
                <span className={styles.tagTaken}>
                  {closed ? "виконав" : "бере"}: {assigneeName}
                </span>
              ))}
            {/* Видана заявка: чи ще діє гарантія — перше, що треба знати, коли клієнт повертається */}
            {r.status === "done" &&
              r.warrantyUntil &&
              (warrantyActive(r.warrantyUntil) ? (
                <span className={styles.tagAccount}>гарантія до {dayFormat.format(r.warrantyUntil)}</span>
              ) : (
                <span className={styles.tagAnon}>гарантія минула</span>
              ))}
            {discount && (
              <span className={styles.tagMine} title="Клієнт лишив відгук із фото до і після">
                {discount.applied ? "знижку −15% враховано" : "знижка −15% за відгук"}
              </span>
            )}
            {/* Чат і доставка ховаються в згорнутій картці — сигнал про них лишаємо зверху */}
            {unread > 0 && <span className={styles.tagHot}>{unread} нов. у чаті</span>}
            {waitingShip && <span className={styles.tagHot}>чекає ТТН</span>}
            <span className={styles.when}>{dateFormat.format(r.createdAt)}</span>
            <span className={styles.source}>{sourceLabel[r.source] ?? r.source}</span>
          </div>

          <div className={styles.contacts}>
            {r.phone && (
              <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className={styles.link}>
                {r.phone}
              </a>
            )}
            {r.email && (
              <a href={`mailto:${r.email}`} className={styles.link}>
                {r.email}
              </a>
            )}
          </div>

          {(r.model || r.service) && <div className={styles.what}>{r.model ?? r.service}</div>}
          {r.problem && <p className={styles.problem}>{r.problem}</p>}
        </>
      }
      side={
        <>
          <StatusSelect id={r.id} status={r.status} delivery={r.deliveryRequested} ttn={r.ttn} />
          <span className={styles.hint}>{s.hint}</span>

          {/* Хто займається заявкою — видно й у згорнутій картці */}
          {!closed && (
            <AssignButton id={r.id} state={mine ? "mine" : r.assignee ? "other" : "free"} />
          )}
        </>
      }
    >
      <QuickActions phone={r.phone} address={r.deliveryAddress} ttn={r.ttn} />

      {/* Доставка: коли клієнт її попросив або майстер уже відправив сам */}
      {(r.deliveryRequested || r.ttn) && (
        <div className={waitingShip ? styles.shipBoxHot : styles.shipBox}>
          <div className={styles.shipHead}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
              <path d="M3 7l9 4 9-4" />
              <path d="M12 11v10" />
            </svg>
            {waitingShip ? "Просить надіслати — ТТН не вписано" : "Відправлено"}
          </div>

          {r.deliveryAddress && <div className={styles.shipAddress}>{r.deliveryAddress}</div>}

          <TtnField id={r.id} ttn={r.ttn} />
        </div>
      )}

      {r.city && !r.deliveryRequested && !r.ttn && <div className={styles.city}>{r.city}</div>}

      <NoteField id={r.id} events={events} />

      <MoneyFields
        id={r.id}
        price={r.price}
        partsCost={r.partsCost}
        prepayment={r.prepayment}
        prepaidAt={r.prepaidAt}
        paidAt={r.paidAt}
        hint={priceHint}
      />

      {discount && !discount.applied && (
        <form action={applyReviewDiscount} className={styles.discountRow}>
          <input type="hidden" name="reviewId" value={discount.reviewId} />
          <input type="hidden" name="leadId" value={r.id} />
          <span className={styles.hint}>
            Клієнт має знижку 15% за відгук. Зменшіть ціну й відмітьте — знижка одноразова.
          </span>
          <button type="submit" className="btn btn-ghost">Знижку враховано</button>
        </form>
      )}

      {r.status !== "rejected" && (
        <WarrantyField
          id={r.id}
          days={r.warrantyDays ?? guessWarrantyDays(r.service ?? r.problem)}
          until={r.warrantyUntil}
          active={r.warrantyUntil ? warrantyActive(r.warrantyUntil) : false}
          handedOver={r.status === "done"}
        />
      )}

      <div className={styles.chatRow}>
        <Chat leadId={r.id} side="master" unread={unread} />

        <div className={styles.cardActions}>
          <a
            href={`/admin/zayavky/${r.id}/kvytantsiya`}
            target="_blank"
            rel="noopener"
            className="btn btn-ghost"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9V3h12v6" />
              <path d="M6 18H4v-6h16v6h-2" />
              <path d="M6 14h12v7H6z" />
            </svg>
            Квитанція
          </a>

          {r.status === "done" && r.warrantyUntil && (
            <a href={`/admin/zayavky/${r.id}/garantiya`} target="_blank" rel="noopener" className="btn btn-ghost">
              Гарантійний талон
            </a>
          )}

          <DeleteLead id={r.id} orderNo={r.orderNo} />
        </div>
      </div>
    </LeadCardFrame>
  );
}
