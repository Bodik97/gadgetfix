"use client";

import { useActionState, useState, useTransition } from "react";
import Chat from "@/components/Chat";
import type { Lead, LeadItem } from "@/db/schema";
import { CHECKS, CONDITION, DUE_HINTS, KIT, PAUSE_REASONS, PAYMENT_LABEL, PROBLEMS } from "@/data/orderOptions";
import { WARRANTY_TERMS } from "@/data/warranty";
import { orderLabel, STAGE_LABEL } from "@/lib/stage";
import DeleteLead from "../../DeleteLead";
import { resumeLead } from "../actions";
import { advance, back, pause, refuse, saveDue, saveLocation, savePayment, savePrepayment, saveWarranty, unrefuse } from "./actions";
import { ChipSet, CopyText, OneOf, TextField } from "./Fields";
import Items, { type StockPart } from "./Items";
import { PhotoSlots, SignaturePad, type PhotoInfo } from "./Media";
import styles from "./order.module.css";

type Stage = Lead["stage"];

/** Кроки картки (ТЗ 3.3). «Видача» — це етап «Готово»: на ньому видають. */
const STEPS_OWN: { stage: Stage; name: string; title: string; next: string }[] = [
  { stage: "new", name: "Прийом", title: "Прийом телефона", next: "Прийняти" },
  { stage: "diagnostics", name: "Діагностика", title: "Діагностика", next: "Надіслати ціну" },
  { stage: "approval", name: "Погодження", title: "Погодження ціни", next: "Клієнт погодив" },
  { stage: "in_progress", name: "У роботі", title: "Ремонт", next: "Ремонт готовий" },
  { stage: "ready", name: "Видача", title: "Перевірка і видача", next: "Видати клієнту" },
];

/** «Онлайн» — без діагностики й погодження: ціна з прайсу магазину */
const STEPS_ONLINE: typeof STEPS_OWN = [
  { stage: "new", name: "Прийом", title: "Прийом від магазину", next: "Взяти в роботу" },
  { stage: "in_progress", name: "У роботі", title: "Ремонт", next: "Ремонт готовий" },
  { stage: "ready", name: "Віддати", title: "Віддати магазину", next: "Віддати магазину" },
];

export type HistoryRow = { at: string; text: string; who: string | null };

const time = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });
const day = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", timeZone: "Europe/Kyiv" });
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" });
const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;

/** Що (і чи) отримає клієнт, коли натиснуть головну кнопку */
function notifyHint(lead: Lead, telegram: boolean | null): string {
  if (lead.channel === "online") return "Магазину нічого не надсилаємо";
  const tg = telegram === true;
  switch (lead.stage) {
    case "new":
      return "Клієнту нічого не надсилаємо — номер є на квитанції";
    case "diagnostics":
      return tg ? "Клієнт отримає ціну в Telegram з кнопкою «Погоджуюсь»" : "Клієнт без Telegram — надішліть ціну у Viber самі";
    case "approval":
      return tg ? "Клієнт отримає «У роботі» в Telegram" : "Клієнт без Telegram — повідомлення не піде";
    case "in_progress":
      return tg ? "Клієнт отримає «Готово» в Telegram" : "Клієнт без Telegram — подзвоніть, що готово";
    case "ready":
      return "Почнеться гарантія, клієнт побачить її в кабінеті";
    default:
      return "";
  }
}

export default function OrderScreen({
  lead,
  items,
  photos,
  signed,
  stageTimes,
  history,
  unread,
  orders,
  stock,
  telegram,
  owner,
  masterName,
  clientAgreed,
}: {
  lead: Lead;
  items: LeadItem[];
  photos: PhotoInfo[];
  signed: { intake: boolean; handover: boolean };
  /** Коли заявка вперше потрапила на кожен етап */
  stageTimes: Partial<Record<Stage, string>>;
  history: HistoryRow[];
  unread: number;
  /** Скільки заявок з цього номера, разом із цією */
  orders: number;
  stock: StockPart[];
  /** Клієнт підключив Telegram-бота; null — бот не налаштований */
  telegram: boolean | null;
  owner: boolean;
  masterName: string | null;
  /** Клієнт натиснув «Погоджуюсь» у Telegram */
  clientAgreed: boolean;
}) {
  const steps = lead.channel === "online" ? STEPS_ONLINE : STEPS_OWN;
  const issued = lead.stage === "issued";
  const currentIndex = issued ? steps.length : Math.max(0, steps.findIndex((s) => s.stage === lead.stage));
  const [viewing, setViewing] = useState<number | null>(null);
  const shown = viewing ?? Math.min(currentIndex, steps.length - 1);
  const step = steps[shown];

  const [checks, setChecks] = useState<string[]>([]);
  const [error, submit, pending] = useActionState(advance, null);
  const [, start] = useTransition();
  const [chatOpen, setChatOpen] = useState(unread > 0);
  const [confirmRefuse, setConfirmRefuse] = useState(false);

  const total = lead.price ?? 0;
  const prepaid = lead.prepaidAt ? (lead.prepayment ?? 0) : 0;
  const toPay = lead.paidAt ? 0 : Math.max(0, total - prepaid);
  const call = (fn: (f: FormData) => Promise<unknown>, entries: Record<string, string>) => {
    const f = new FormData();
    f.set("id", lead.id);
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    start(async () => {
      await fn(f);
    });
  };

  const status = lead.flag === "refused"
    ? { text: "Відмова", cls: styles.tagRed }
    : lead.flag === "paused"
      ? { text: "Пауза", cls: styles.tagAmber }
      : issued
        ? { text: "Видано", cls: styles.tagLime }
        : { text: steps[currentIndex]?.name ?? STAGE_LABEL[lead.stage], cls: styles.tagAmber };

  const problem = lead.problems.length > 0 ? lead.problems.join(", ") : (lead.service ?? lead.problem ?? "");
  const phoneDigits = (lead.phone ?? "").replace(/\D/g, "");
  const intl = phoneDigits.startsWith("380") ? phoneDigits : phoneDigits.startsWith("0") ? `38${phoneDigits}` : phoneDigits;
  const priceMessage = `${lead.name.split(" ")[0]}, ваш ${lead.model ?? "телефон"}: ${items
    .filter((i) => i.kind === "work")
    .map((i) => i.title.toLowerCase())
    .join(", ") || "ремонт"} — ${uah(total)}${lead.dueAt ? `, буде готово ${day.format(lead.dueAt)}` : ""}. Підтвердіть, будь ласка, відповіддю «Так». Заявка №${lead.orderNo}.`;

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <span className={styles.no}>{orderLabel(lead)}</span>
        <h1 className={styles.model}>{lead.model ?? "Модель не вказана"}</h1>
        {problem && <span className={styles.problem}>{problem}</span>}
        <span className={status.cls}>{status.text}</span>
        <span className={styles.meta}>
          {lead.dueAt && !issued && (
            <>
              Готово до <b>{day.format(lead.dueAt)}</b> ·{" "}
            </>
          )}
          майстер <b>{masterName ?? "ще ніхто"}</b>
        </span>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          <ol className={styles.steps} aria-label="Етапи" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => {
              const done = i < currentIndex;
              const cur = i === currentIndex;
              return (
                <li key={s.stage}>
                  <button
                    type="button"
                    className={cur ? styles.stepCur : done ? styles.stepDone : styles.step}
                    aria-current={cur ? "step" : undefined}
                    aria-pressed={shown === i}
                    onClick={() => setViewing(i === currentIndex ? null : i)}
                  >
                    <span className={styles.stepDot}>{done ? "✓" : i + 1}</span>
                    <span className={styles.stepText}>
                      <span>{s.name}</span>
                      <span className={styles.stepTime}>
                        {stageTimes[s.stage] ? time.format(new Date(stageTimes[s.stage]!)) : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {lead.flag === "paused" && (
            <div className={styles.bannerAmber}>
              <span>На паузі · {lead.pauseReason ?? "чекаємо деталь"}</span>
              <button type="button" className={styles.bannerBtn} onClick={() => call(resumeLead, {})}>
                Продовжити
              </button>
            </div>
          )}
          {lead.flag === "refused" && (
            <div className={styles.bannerRed}>
              <span>Клієнт відмовився · телефон повертаємо без ремонту</span>
              <button type="button" className={styles.bannerBtn} onClick={() => call(unrefuse, {})}>
                Повернути
              </button>
            </div>
          )}
          {issued && (
            <div className={styles.bannerLime}>
              {lead.channel === "online"
                ? "Віддано магазину"
                : `Видано клієнту${lead.warrantyUntil ? ` · гарантія до ${day.format(lead.warrantyUntil)}` : " · без гарантії"}`}
            </div>
          )}
          {viewing !== null && viewing !== currentIndex && (
            <p className={styles.viewingNote}>
              Ви дивитесь крок «{step.name}».{" "}
              <button type="button" className={styles.linkBtn} onClick={() => setViewing(null)}>
                До поточного кроку
              </button>
            </p>
          )}

          <section className={styles.card} aria-labelledby="step-title">
            <h2 id="step-title" className={styles.cardTitle}>
              {step.title}
            </h2>

            {step.stage === "new" && (
              <div className={styles.grid2}>
                <div className={styles.col}>
                  {lead.channel === "own" && (
                    <>
                      <p className={styles.label}>Що сталося</p>
                      <ChipSet id={lead.id} field="problems" options={PROBLEMS} value={lead.problems} label="Що сталося" />
                    </>
                  )}
                  <TextField id={lead.id} field="model" value={lead.model} label="Модель" placeholder="iPhone 13 Pro · 256 ГБ" />
                  <TextField id={lead.id} field="imei" value={lead.imei} label="IMEI" hint="необовʼязково" placeholder="*#06#" />
                  {lead.channel === "own" && (
                    <>
                      <p className={styles.label}>Точка</p>
                      <OneOf
                        label="Точка"
                        options={[
                          { value: "lviv", label: "Львів" },
                          { value: "novyi-rozdil", label: "Новий Розділ" },
                          { value: "other", label: "Інше місто" },
                        ]}
                        value={lead.location}
                        onPick={(v) => call(saveLocation, { value: v })}
                      />
                      {lead.location === "other" && (
                        <TextField id={lead.id} field="city" value={lead.city} label="Місто" placeholder="Стрий" />
                      )}
                    </>
                  )}
                  <DueField lead={lead} onSave={(v) => call(saveDue, { value: v })} />
                </div>
                <div className={styles.col}>
                  <p className={styles.label}>Стан</p>
                  <ChipSet id={lead.id} field="condition" options={CONDITION} value={lead.condition} label="Стан" />
                  <p className={styles.label}>Комплект</p>
                  <ChipSet id={lead.id} field="kit" options={KIT} value={lead.kit} label="Комплект" />
                  {lead.channel === "own" && (
                    <>
                      <p className={styles.label}>
                        Фото до ремонту <span className={styles.required}>· обовʼязково</span>
                      </p>
                      <PhotoSlots id={lead.id} photos={photos} />
                      <p className={styles.label}>
                        Підпис клієнта <span className={styles.required}>· обовʼязково</span>
                      </p>
                      <SignaturePad id={lead.id} kind="intake" signed={signed.intake} />
                    </>
                  )}
                  {lead.channel === "online" && lead.problem && (
                    <p className={styles.note}>Примітка магазину: {lead.problem}</p>
                  )}
                </div>
              </div>
            )}

            {step.stage === "diagnostics" && (
              <div className={styles.grid2}>
                <div className={styles.col}>
                  <TextField id={lead.id} field="diagnosis" value={lead.diagnosis} label="Що знайшли" multiline placeholder="Зношений роз'єм заряджання" />
                  <TextField id={lead.id} field="masterNote" value={lead.masterNote} label="Нотатка для своїх" hint="клієнт не бачить" multiline />
                </div>
                <div className={styles.col}>
                  <p className={styles.label}>
                    Роботи і деталі <span className={styles.required}>· хоча б одна робота</span>
                  </p>
                  <Items id={lead.id} items={items} stock={stock} locked={lead.paidAt !== null} />
                </div>
              </div>
            )}

            {step.stage === "approval" && (
              <div className={styles.grid2}>
                <div className={styles.col}>
                  <div className={styles.facts}>
                    <div>
                      <p className={styles.label}>Ціна</p>
                      <p className={styles.fact}>{uah(total)}</p>
                    </div>
                    <div>
                      <p className={styles.label}>Готово до</p>
                      <p className={styles.fact}>{lead.dueAt ? day.format(lead.dueAt) : "—"}</p>
                    </div>
                  </div>
                  <DueField lead={lead} onSave={(v) => call(saveDue, { value: v })} />
                  <WarrantyPick lead={lead} onPick={(d) => call(saveWarranty, { days: String(d) })} />
                </div>
                <div className={styles.col}>
                  <p className={styles.label}>Повідомлення клієнту</p>
                  {clientAgreed ? (
                    <p className={styles.okNote}>Клієнт погодив ціну в Telegram ✓</p>
                  ) : telegram ? (
                    <p className={styles.note}>Ціну надіслано в Telegram з кнопкою «Погоджуюсь». Чекаємо відповідь.</p>
                  ) : (
                    <p className={styles.note}>Клієнт без Telegram — надішліть у Viber або подзвоніть:</p>
                  )}
                  <CopyText text={priceMessage} />
                </div>
              </div>
            )}

            {step.stage === "in_progress" && (
              <div className={styles.grid2}>
                {lead.channel === "own" && (
                  <div className={styles.col}>
                    <p className={styles.label}>Деталі</p>
                    {items.filter((i) => i.kind === "part").length === 0 ? (
                      <p className={styles.labelHint}>Деталей у заявці немає.</p>
                    ) : (
                      items
                        .filter((i) => i.kind === "part")
                        .map((i) => (
                          <div key={i.id} className={styles.item}>
                            <span className={styles.itemTitle}>{i.title}</span>
                            <span className={styles.labelHint}>
                              {i.writtenOffAt ? "списано зі складу" : i.partId ? "спишеться зі складу" : "під замовлення"}
                            </span>
                          </div>
                        ))
                    )}
                    <p className={styles.labelHint}>Деталі немає? Натисніть «Пауза» — заявка позначиться на дошці.</p>
                  </div>
                )}
                <div className={styles.col}>
                  <TextField id={lead.id} field="masterNote" value={lead.masterNote} label="Нотатка для своїх" hint="клієнт не бачить" multiline />
                </div>
              </div>
            )}

            {step.stage === "ready" && (
              <div className={styles.grid2}>
                <div className={styles.col}>
                  {lead.channel === "own" ? (
                    <>
                      <p className={styles.label}>
                        Перевірка перед видачею <span className={styles.required}>· усі пункти</span>
                      </p>
                      <div className={styles.checks}>
                        {CHECKS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={checks.includes(c) ? styles.checkOn : styles.check}
                            aria-pressed={checks.includes(c)}
                            onClick={() => setChecks(checks.includes(c) ? checks.filter((x) => x !== c) : [...checks, c])}
                          >
                            {checks.includes(c) ? "✓ " : ""}
                            {c}
                          </button>
                        ))}
                      </div>
                      <WarrantyPick lead={lead} onPick={(d) => call(saveWarranty, { days: String(d) })} />
                    </>
                  ) : (
                    <p className={styles.note}>Телефон повертається в магазин {lead.externalNo ?? ""}. Ціна за прайсом: {uah(total)}.</p>
                  )}
                </div>
                {lead.channel === "own" && (
                  <div className={styles.col}>
                    <p className={styles.label}>
                      Оплата · <b>{uah(toPay)}</b> до сплати
                    </p>
                    <OneOf
                      label="Спосіб оплати"
                      options={(Object.keys(PAYMENT_LABEL) as (keyof typeof PAYMENT_LABEL)[]).map((k) => ({ value: k, label: PAYMENT_LABEL[k] }))}
                      value={lead.paymentMethod}
                      onPick={(v) => call(savePayment, { value: v })}
                    />
                    <p className={styles.label}>
                      Підпис при видачі <span className={styles.required}>· обовʼязково</span>
                    </p>
                    <SignaturePad id={lead.id} kind="handover" signed={signed.handover} />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* У магазину «Онлайн» клієнта немає — листуватися нема з ким */}
          {lead.channel === "own" && (
            <section className={styles.chatBox}>
              <button type="button" className={styles.chatToggle} aria-expanded={chatOpen} onClick={() => setChatOpen(!chatOpen)}>
                Листування з клієнтом
                {unread > 0 && <span className={styles.unread}>{unread} нов.</span>}
                <span className={styles.chev} aria-hidden="true">{chatOpen ? "▴" : "▾"}</span>
              </button>
              {chatOpen && <Chat leadId={lead.id} side="master" unread={unread} />}
            </section>
          )}

          {!issued && (
            <form action={submit} className={styles.bar}>
              <input type="hidden" name="id" value={lead.id} />
              {checks.map((c) => (
                <input key={c} type="hidden" name="check" value={c} />
              ))}
              {currentIndex > 0 && lead.flag === null && (
                <button type="button" className={styles.ghostBtn} onClick={() => call(back, {})}>
                  ‹ Назад
                </button>
              )}
              {lead.flag === null && <PauseButton id={lead.id} />}
              {lead.flag !== "refused" &&
                (confirmRefuse ? (
                  <button type="button" className={styles.dangerBtn} onClick={() => call(refuse, {})}>
                    Так, відмова
                  </button>
                ) : (
                  <button type="button" className={styles.ghostBtn} onClick={() => setConfirmRefuse(true)}>
                    Відмова
                  </button>
                ))}
              {error ? (
                <span role="alert" className={styles.barError}>
                  {error}
                </span>
              ) : (
                <span className={styles.barHint}>{notifyHint(lead, telegram)}</span>
              )}
              <button type="submit" className={styles.mainBtn} disabled={pending}>
                {steps[currentIndex]?.next ?? "Далі"} →
              </button>
            </form>
          )}
        </div>

        <aside className={styles.side} aria-label="Картка заявки">
          {lead.channel === "own" ? (
            <div className={styles.panel}>
              <p className={styles.panelTitle}>Клієнт</p>
              <p className={styles.client}>{lead.name}</p>
              <p className={styles.labelHint}>
                {lead.phone ?? "без телефону"}
                {lead.deliveryRequested ? " · доставка Новою Поштою" : ""}
              </p>
              <p className={styles.labelHint}>{orders > 1 ? `${orders}-тя заявка з цього номера` : "перша заявка"}</p>
              {lead.phone && (
                <div className={styles.row2}>
                  <a href={`tel:+${intl}`} className={styles.softBtn}>
                    Подзвонити
                  </a>
                  <a href={`viber://chat?number=%2B${intl}`} className={styles.ghostBtn}>
                    Viber
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.panel}>
              <p className={styles.panelTitle}>Магазин «Онлайн»</p>
              <p className={styles.client}>{lead.externalNo ?? "№ не вказано"}</p>
            </div>
          )}

          <div className={styles.panel}>
            <p className={styles.panelTitle}>Пристрій</p>
            <dl className={styles.dl}>
              <dt>Модель</dt>
              <dd>{lead.model ?? "—"}</dd>
              <dt>IMEI</dt>
              <dd>{lead.imei ?? "—"}</dd>
              <dt>Стан</dt>
              <dd>{lead.condition.join(", ") || "—"}</dd>
              <dt>Комплект</dt>
              <dd>{lead.kit.join(", ") || "—"}</dd>
            </dl>
          </div>

          <div className={styles.panel}>
            <p className={styles.panelTitle}>Гроші</p>
            <div className={styles.money}>
              <span>Робота і деталі</span>
              <span>{uah(total)}</span>
            </div>
            {lead.channel === "own" && <Prepayment lead={lead} />}
            <div className={styles.moneyTotal}>
              <span>{lead.paidAt ? "Оплачено" : "До сплати"}</span>
              <span>{lead.paidAt ? uah(total) : uah(toPay)}</span>
            </div>
          </div>

          <div className={styles.panel}>
            <p className={styles.panelTitle}>Друк</p>
            <div className={styles.printRow}>
              <a href={`/admin/zayavky/${lead.id}/naklejka`} target="_blank" rel="noopener" className={styles.ghostBtn}>
                Наклейка
              </a>
              {lead.channel === "own" && (
                <a href={`/admin/zayavky/${lead.id}/kvytantsiya`} target="_blank" rel="noopener" className={styles.ghostBtn}>
                  Квитанція
                </a>
              )}
              {issued && lead.warrantyUntil && (
                <a href={`/admin/zayavky/${lead.id}/garantiya`} target="_blank" rel="noopener" className={styles.ghostBtn}>
                  Гарантія
                </a>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <p className={styles.panelTitle}>Історія</p>
            <ol className={styles.history}>
              {history.length === 0 && <li className={styles.labelHint}>Ще нічого.</li>}
              {history.map((h, i) => (
                <li key={i}>
                  <span className={styles.historyTime}>{time.format(new Date(h.at))}</span>
                  <span>
                    {h.text}
                    {h.who && <span className={styles.labelHint}> · {h.who}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Видаляє лише власник; майстер редагує, але не стирає */}
          {owner && (
            <div className={styles.deleteRow}>
              <DeleteLead id={lead.id} orderNo={lead.orderNo} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Термін «Готово до»: дата або підказка «завтра / +3 дні» */
function DueField({ lead, onSave }: { lead: Lead; onSave: (v: string) => void }) {
  return (
    <div className={styles.field}>
      <label htmlFor="f-due" className={styles.label}>
        Готово до
      </label>
      <input
        id="f-due"
        type="date"
        className={styles.input}
        defaultValue={lead.dueAt ? isoDay.format(lead.dueAt) : ""}
        key={lead.dueAt?.toString() ?? "none"}
        onChange={(e) => onSave(e.target.value)}
      />
      <div className={styles.chips}>
        {DUE_HINTS.map((h) => (
          <button key={h.days} type="button" className={styles.chip} onClick={() => onSave(String(h.days))}>
            {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function WarrantyPick({ lead, onPick }: { lead: Lead; onPick: (days: number) => void }) {
  return (
    <div className={styles.field}>
      <p className={styles.label}>Гарантія</p>
      <OneOf
        label="Гарантія"
        options={WARRANTY_TERMS.map((t) => ({ value: String(t.days), label: `${t.label} — ${t.scope}` }))}
        value={lead.warrantyDays === null ? null : String(lead.warrantyDays)}
        onPick={(v) => onPick(Number(v))}
      />
    </div>
  );
}

/** Передоплата: сума й «отримали» однією дією — без галочки на 0 ₴ */
function Prepayment({ lead }: { lead: Lead }) {
  const [error, act, pending] = useActionState(async (_: string | null, f: FormData) => savePrepayment(f), null);
  const has = lead.prepaidAt !== null && lead.prepayment;
  return (
    <form action={act} className={styles.prepay}>
      <input type="hidden" name="id" value={lead.id} />
      <label htmlFor="f-prepay" className={styles.moneyLabel}>
        Передоплата{has ? ` · ${day.format(lead.prepaidAt!)}` : ""}
      </label>
      <div className={styles.prepayRow}>
        <input
          id="f-prepay"
          name="amount"
          inputMode="numeric"
          pattern="[0-9 ]*"
          maxLength={9}
          className={styles.inputSmall}
          defaultValue={has ? String(lead.prepayment) : ""}
          placeholder="0"
          disabled={lead.paidAt !== null}
        />
        {lead.paidAt === null && (
          <button type="submit" className={styles.softBtn} disabled={pending}>
            {has ? "Змінити" : "Отримали"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.inlineError}>
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * «Пауза» з обовʼязковою причиною: натиснули — зʼявляються варіанти
 * (або своя причина), без причини заявка на паузу не стане.
 */
function PauseButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pick(reason: string) {
    const f = new FormData();
    f.set("id", id);
    f.set("reason", reason);
    start(async () => {
      const res = await pause(f);
      setError(res);
      if (!res) setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" className={styles.ghostBtn} onClick={() => setOpen(true)}>
        Пауза
      </button>
    );
  }

  return (
    <div className={styles.pausePick} role="group" aria-label="На що чекаємо">
      <span className={styles.labelHint}>На що чекаємо?</span>
      {PAUSE_REASONS.map((r) => (
        <button key={r} type="button" className={styles.chip} disabled={pending} onClick={() => pick(r)}>
          {r}
        </button>
      ))}
      <input
        className={styles.inputSmall}
        style={{ width: 160 }}
        placeholder="інше…"
        value={other}
        aria-label="Своя причина паузи"
        onChange={(e) => setOther(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            pick(other);
          }
        }}
      />
      {other.trim() && (
        <button type="button" className={styles.softBtn} disabled={pending} onClick={() => pick(other)}>
          На паузу
        </button>
      )}
      <button type="button" className={styles.iconBtn} aria-label="Скасувати" onClick={() => setOpen(false)}>
        ×
      </button>
      {error && (
        <span role="alert" className={styles.inlineError}>
          {error}
        </span>
      )}
    </div>
  );
}
