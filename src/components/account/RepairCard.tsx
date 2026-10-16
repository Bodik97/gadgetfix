import { describeStatus } from "@/db/leads";
import type { Lead, LeadEvent } from "@/db/schema";
import Chat from "@/components/Chat";
import TelegramConnect from "@/components/TelegramConnect";
import { connectLink } from "@/lib/clientBot";
import { masterPhone } from "@/lib/admin";
import DeliveryRequest from "./DeliveryRequest";
import Parcel from "./Parcel";
import ReceivedButton from "./ReceivedButton";
import RepairSteps from "./RepairSteps";
import Timeline from "./Timeline";
import styles from "./RepairCard.module.css";

const dateTime = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

/** Іконка стадії — щоб стан читався не лише кольором */
function StatusIcon({ tone }: { tone: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (tone === "shipped") {
    return (
      <svg {...common}>
        <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
        <path d="M3 7l9 4 9-4" />
      </svg>
    );
  }

  if (tone === "ready" || tone === "done") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </svg>
    );
  }

  if (tone === "closed") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9l-6 6" />
        <path d="M9 9l6 6" />
      </svg>
    );
  }

  // У роботі
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export default function RepairCard({
  lead,
  events,
  unread = 0,
}: {
  lead: Lead;
  events: LeadEvent[];
  /** Непрочитані від майстра — щоб клієнт не пропустив відповідь */
  unread?: number;
}) {
  const s = describeStatus(lead.status);
  const what = lead.model ?? lead.service ?? "Ремонт";
  // Дзвінок — майстру, що взяв заявку; поки ніхто не взяв, лишається чат
  const phone = masterPhone(lead.assignee);

  return (
    <article className={`${styles.card} ${styles[s.tone]}`}>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <span className={styles.orderNo}>№&#8202;{lead.orderNo}</span>
          <h2 className={styles.what}>{what}</h2>
        </div>

        <span className={styles.badge}>
          <StatusIcon tone={s.tone} />
          {s.label}
        </span>
      </header>

      <p className={styles.hint}>{s.hint}</p>

      <RepairSteps status={s} />

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Прийнято</dt>
          <dd>{dateTime.format(lead.createdAt)}</dd>
        </div>

        {lead.problem && (
          <div className={styles.fact}>
            <dt>Проблема</dt>
            <dd>{lead.problem}</dd>
          </div>
        )}

        {lead.price !== null && (
          <div className={styles.fact}>
            <dt>Ціна</dt>
            <dd className={styles.price}>
              {lead.price.toLocaleString("uk-UA")} ₴
              <span className={styles.priceNote}>
                {lead.paidAt ? "оплачено" : "погоджена — не зміниться"}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {/* Передоплата за деталь — умова початку робіт */}
      {lead.prepayment !== null && !lead.paidAt && (
        <div className={lead.prepaidAt ? styles.payDone : styles.payWait}>
          <span className={styles.payIcon} aria-hidden="true">
            {lead.prepaidAt ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12.5l2.5 2.5L16 9.5" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
                <path d="M2.5 10h19" />
              </svg>
            )}
          </span>

          <div className={styles.payBody}>
            <div className={styles.payTitle}>
              {lead.prepaidAt
                ? `Передоплату отримано — ${lead.prepayment.toLocaleString("uk-UA")} ₴`
                : `Передоплата за деталь — ${lead.prepayment.toLocaleString("uk-UA")} ₴`}
            </div>
            <p className={styles.payText}>
              {lead.prepaidAt
                ? lead.price !== null
                  ? `Решта ${Math.max(0, lead.price - lead.prepayment).toLocaleString("uk-UA")} ₴ — при видачі.`
                  : "Решту доплачуєте при видачі."
                : lead.price !== null
                  ? `Деталь замовляємо після передоплати. Решта ${Math.max(0, lead.price - lead.prepayment).toLocaleString("uk-UA")} ₴ — при видачі.`
                  : "Деталь замовляємо після передоплати, решту доплачуєте при видачі."}
            </p>
          </div>
        </div>
      )}

      {/* Посилка — головне, що людина шукає, коли пристрій уже відправили */}
      {lead.ttn && <Parcel ttn={lead.ttn} address={lead.deliveryAddress} />}

      {/* Доставку пропонуємо, лише коли є що відправляти */}
      {s.finished && !lead.ttn && (
        <div data-guide="delivery">
          <DeliveryRequest
            id={lead.id}
            requested={lead.deliveryRequested}
            address={lead.deliveryAddress}
          />
        </div>
      )}

      {/* Готовий чи відправлений — клієнт сам підтверджує, що пристрій уже в нього */}
      {s.active && s.finished && (
        <div data-guide="received">
          <ReceivedButton id={lead.id} received={Boolean(lead.receivedAt)} />
        </div>
      )}

      <Timeline events={events} />

      {/* Чат — головна дія й завжди перший: розгорнувшись, він займає рядок,
          а дзвінок і Telegram лишаються разом під ним */}
      <div className={styles.actions} data-guide="chat">
        <Chat leadId={lead.id} side="client" unread={unread} />

        {phone && (
          <a href={phone.href} className={`btn btn-ghost ${styles.action}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
            </svg>
            Подзвонити
          </a>
        )}

        <TelegramConnect href={connectLink(lead)} label="Статус у Telegram" quiet className={styles.action} />
      </div>
    </article>
  );
}
