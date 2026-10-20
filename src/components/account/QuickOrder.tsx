"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { bookingModels } from "@/data/landing";
import ServiceSelect from "../ServiceSelect";
import { site } from "@/data/site";
import FormError from "../FormError";
import FormField, { fieldState } from "../FormField";
import PhoneInput from "../PhoneInput";
import DiscountTicket from "./DiscountTicket";
import { DISCOUNT_PERCENT, type DiscountKind } from "@/data/discounts";
import { LIMITS, phoneProblem, plainText } from "@/lib/validate";
import styles from "./QuickOrder.module.css";

/**
 * Після першої заявки сторінка оновлюється, і форма з порожнього стану
 * переїжджає вниз — це вже новий компонент. Позначка живе поза ним, щоб
 * «Заявку прийнято» не зникало разом зі старим.
 */
let justSent = false;
/** Номер заявки й закріплена знижка — для того ж підтвердження після оновлення */
let lastResult: Result = { orderNo: null, discount: null };

type Result = { orderNo: number | null; discount: DiscountKind | null };

export default function QuickOrder({
  compact,
  collapsed,
  offer = null,
  knownPhone = null,
}: {
  compact?: boolean;
  /** Згорнути в кнопку «+ Замовити ще один ремонт» — коли вже є ремонт у роботі */
  collapsed?: boolean;
  /** Яка знижка чекає на це замовлення: 5% забирають кнопкою, решта діє сама */
  offer?: DiscountKind | null;
  /** Телефон із попередніх заявок — щоб не вводити вдруге */
  knownPhone?: string | null;
}) {
  const { user } = useUser();
  const router = useRouter();
  const params = useSearchParams();

  // Послуга й модель можуть прийти посиланням із сайту: ?service=…&model=…
  const presetService = params.get("service") ?? "";
  const presetModel = params.get("model") ?? "";
  const [service, setService] = useState(presetService);
  const [model, setModel] = useState(presetModel);
  const [note, setNote] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(justSent);
  const [result, setResult] = useState<Result>(lastResult);

  // ?znyzhka=1 — прийшли з «Скористатись» на сторінці знижок, ?vitayemo=1 — щойно зареєструвались
  const [applied, setApplied] = useState(params.get("znyzhka") === "1");
  const celebrate = params.get("vitayemo") === "1" && offer === "signup";
  // 5% за реєстрацію забирають кнопкою; решта знижок діє сама
  const discountOn = offer !== null && (offer !== "signup" || applied);

  // У списку моделі згруповані («iPhone 13 / 14»), а зі сторінки моделі приходить
  // точна назва — додаємо її окремим рядком, інакше поле показувало б «Оберіть модель»
  const models = presetModel && !bookingModels.includes(presetModel) ? [presetModel, ...bookingModels] : bookingModels;

  // Прийшли з кнопки «Записатись» — форма може бути в самому низу сторінки,
  // під активними ремонтами. Так само з підтвердженням після оновлення сторінки
  const cardRef = useRef<HTMLDivElement>(null);
  // ?zamovyty=1 — прийшли саме замовити («Записатись», «Замовити ремонт»): форму відкриваємо одразу
  const preset = Boolean(presetService || presetModel) || params.get("zamovyty") === "1" || applied;
  const [expanded, setExpanded] = useState(!collapsed || preset);
  useEffect(() => {
    if (preset || justSent) cardRef.current?.scrollIntoView({ block: "center" });
    justSent = false;
  }, [preset]);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const profilePhone = user?.primaryPhoneNumber?.phoneNumber ?? "";
  // Без телефону майстрові нікому передзвонити й назвати ціну — питаємо його тут
  const [typedPhone, setTypedPhone] = useState(knownPhone ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const phone = profilePhone || typedPhone;
  const contact = phone || email;

  const send = async () => {
    if (!service && !note.trim()) {
      setError("Оберіть послугу або опишіть, що трапилось.");
      return;
    }
    if (!profilePhone) {
      const problem = phoneProblem(typedPhone);
      if (problem) {
        setPhoneError(problem);
        document.getElementById("qo-phone")?.focus();
        return;
      }
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Контакти беремо з профілю — клієнт уже авторизований
        body: JSON.stringify({
          name: user?.firstName ?? email,
          phone,
          email,
          model,
          service,
          problem: note,
          source: "landing",
          useDiscount: offer === "signup" && applied,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Partial<Result>;
      lastResult = { orderNo: data.orderNo ?? null, discount: data.discount ?? null };
      setResult(lastResult);

      setSent(true);
      // Лише з порожнього стану: там оновлення сторінки замінює цю форму новою
      justSent = Boolean(compact);
      // Заявка має одразу з'явитись угорі, у «Зараз у роботі»
      router.refresh();
    } catch {
      setError(`Не вдалося надіслати. Зателефонуйте, будь ласка: ${site.phones[0].label}`);
    } finally {
      setSending(false);
    }
  };

  if (!expanded && !sent) {
    return (
      <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
        <span aria-hidden="true">+</span> Замовити ще один ремонт
      </button>
    );
  }

  if (sent) {
    return (
      <div ref={cardRef} className={styles.card}>
        <div className={styles.done}>
          <span className={styles.doneIcon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" />
            </svg>
          </span>

          <div>
            <div className={styles.doneTitle}>
              {result.orderNo ? `Заявку №${result.orderNo} прийнято` : "Заявку прийнято"}
            </div>
            {result.discount && (
              <p className={styles.doneDiscount}>
                Знижку {DISCOUNT_PERCENT[result.discount]}% закріплено за замовленням — майстер назве ціну вже з нею.
              </p>
            )}
            <p className={styles.doneText}>
              Зв&apos;яжемося {contact ? <>з вами ({contact})</> : "з вами"} протягом 25 хвилин.
              Заявка вже вгорі цієї сторінки — там буде видно кожен етап.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setSent(false);
            justSent = false;
            lastResult = { orderNo: null, discount: null };
            setService("");
            setModel("");
            setNote("");
          }}
        >
          Замовити ще одну послугу
        </button>
      </div>
    );
  }

  return (
    <div ref={cardRef} className={styles.card}>
      <div className={styles.head}>
        {/* У порожньому стані заголовок дає сама секція — другий тут зайвий */}
        {!compact && <h3 className={styles.title}>Ще один ремонт</h3>}
        <p className={styles.lead}>
          {profilePhone ? "Ваші контакти вже є — оберіть послугу" : "Оберіть послугу"} й натисніть
          «Замовити». Решту спитаємо по телефону. Діагностика безкоштовна, якщо ремонтуємо в нас;
          ремонт — за передоплатою за деталь після погодження ціни.
        </p>
      </div>

      <div className={styles.row}>
        <label htmlFor="qo-service" className={styles.label}>
          Що потрібно зробити
        </label>
        <ServiceSelect
          id="qo-service"
          value={service}
          onChange={(v) => {
            setService(v);
            setError("");
          }}
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="qo-model" className={styles.label}>
          Пристрій
        </label>
        <select
          id="qo-model"
          className="field"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          <option value="">Оберіть модель</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.row}>
        <label htmlFor="qo-note" className={styles.label}>
          Що трапилось <span className={styles.optional}>— не обов&apos;язково</span>
        </label>
        <textarea
          id="qo-note"
          className={`field ${styles.textarea}`}
          placeholder="Напр. не тримає заряд, гріється при зарядці"
          value={note}
          onChange={(e) => {
            setNote(plainText(e.target.value, LIMITS.problem, true));
            setError("");
          }}
        />
      </div>

      {!profilePhone && (
        <FormField
          id="qo-phone"
          label="Телефон"
          hint="Передзвонимо й назвемо ціну. Після +38 починайте з&nbsp;нуля."
          error={phoneError}
        >
          <PhoneInput
            {...fieldState("qo-phone", phoneError)}
            value={typedPhone}
            onChange={(v) => {
              setTypedPhone(v);
              if (phoneError) setPhoneError(phoneProblem(v));
            }}
            onBlur={() => typedPhone && setPhoneError(phoneProblem(typedPhone))}
          />
        </FormField>
      )}

      {offer && (
        <div className={styles.wide}>
          <DiscountTicket
            kind={offer}
            applied={applied}
            onApply={() => setApplied(true)}
            onCancel={() => setApplied(false)}
            celebrate={celebrate}
          />
        </div>
      )}

      <FormError>{error}</FormError>

      <button
        type="button"
        onClick={send}
        className={`btn btn-accent btn-lg ${styles.submit}`}
        disabled={sending}
      >
        {sending ? "Надсилаємо…" : discountOn && offer ? `Замовити зі знижкою ${DISCOUNT_PERCENT[offer]}%` : "Замовити"}
      </button>
    </div>
  );
}
