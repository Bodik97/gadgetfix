"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { bookingModels } from "@/data/landing";
import ServiceSelect from "../ServiceSelect";
import { site } from "@/data/site";
import FormError from "../FormError";
import { LIMITS, plainText } from "@/lib/validate";
import styles from "./QuickOrder.module.css";

/**
 * Після першої заявки сторінка оновлюється, і форма з порожнього стану
 * переїжджає вниз — це вже новий компонент. Позначка живе поза ним, щоб
 * «Заявку прийнято» не зникало разом зі старим.
 */
let justSent = false;

export default function QuickOrder({ compact }: { compact?: boolean }) {
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

  // У списку моделі згруповані («iPhone 13 / 14»), а зі сторінки моделі приходить
  // точна назва — додаємо її окремим рядком, інакше поле показувало б «Оберіть модель»
  const models = presetModel && !bookingModels.includes(presetModel) ? [presetModel, ...bookingModels] : bookingModels;

  // Прийшли з кнопки «Записатись» — форма може бути в самому низу сторінки,
  // під активними ремонтами. Так само з підтвердженням після оновлення сторінки
  const cardRef = useRef<HTMLDivElement>(null);
  const preset = Boolean(presetService || presetModel);
  useEffect(() => {
    if (preset || justSent) cardRef.current?.scrollIntoView({ block: "center" });
    justSent = false;
  }, [preset]);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const phone = user?.primaryPhoneNumber?.phoneNumber ?? "";
  const contact = phone || email;

  const send = async () => {
    if (!service && !note.trim()) {
      setError("Оберіть послугу або опишіть, що трапилось.");
      return;
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
          phone: phone || "—",
          email,
          model,
          service,
          problem: note,
          source: "landing",
        }),
      });
      if (!res.ok) throw new Error(String(res.status));

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
            <div className={styles.doneTitle}>Заявку прийнято</div>
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
          Ваші контакти вже є — оберіть послугу й натисніть «Замовити». Решту спитаємо по
          телефону. Діагностика безкоштовна; ремонт — за передоплатою за деталь після
          погодження ціни.
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

      <FormError>{error}</FormError>

      <button
        type="button"
        onClick={send}
        className={`btn btn-accent btn-lg ${styles.submit}`}
        disabled={sending}
      >
        {sending ? "Надсилаємо…" : "Замовити"}
      </button>
    </div>
  );
}
