"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { bookingModels } from "@/data/landing";
import { askContacts, askModel, done, greeting, symptoms, type Symptom } from "@/data/botScript";
import { site } from "@/data/site";
import FormError from "./FormError";
import styles from "./ChatBot.module.css";
import TelegramConnect from "@/components/TelegramConnect";
import PhoneInput, { formatPhone, localDigits, phoneComplete } from "./PhoneInput";
import { LIMITS, onlyLetters, plainText, validName } from "@/lib/validate";

type Line = { from: "bot" | "me"; text: string };

type Step = "symptom" | "describe" | "model" | "modelText" | "contacts" | "sent";

/** Моделі для швидкого вибору. «Інше / не знаю» замінює кнопка, що дає вписати свою */
const modelChips = bookingModels.filter((m) => m !== "Інше / не знаю");

/** Пауза перед відповіддю помічника — щоб репліки не з'являлись усі разом */
const TYPING_MS = 550;

/** Іван — намальований робот у кольорах бренду: одразу видно, що відповідає не людина */
function BotAvatar({ size }: { size: number }) {
  return (
    <svg className={styles.avatar} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#111311" />
      <path d="M20 6.5v4" stroke="#DCF35A" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20" cy="5.8" r="1.9" fill="#DCF35A" />
      <rect x="9.5" y="11" width="21" height="17" rx="6" fill="#DCF35A" />
      <rect x="6.6" y="16.5" width="2.4" height="6" rx="1.2" fill="#DCF35A" />
      <rect x="31" y="16.5" width="2.4" height="6" rx="1.2" fill="#DCF35A" />
      <circle cx="15.8" cy="18.6" r="2.3" fill="#111311" />
      <circle cx="24.2" cy="18.6" r="2.3" fill="#111311" />
      <path d="M15.6 23.6c1.3 1.3 2.8 1.9 4.4 1.9s3.1-.6 4.4-1.9" fill="none" stroke="#111311" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function ChatBot() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ from: "bot", text: greeting }]);
  const [step, setStep] = useState<Step>("symptom");
  const [typing, setTyping] = useState(false);
  // Скільки реплік помічника ще в черзі. Кнопки відповіді чекають останню:
  // між двома репліками поспіль «друкує» на мить гасне, і вони блимали б
  const [queued, setQueued] = useState(0);

  const [symptom, setSymptom] = useState<Symptom | null>(null);
  const [details, setDetails] = useState("");
  const [model, setModel] = useState("");
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [telegram, setTelegram] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  // Нова репліка має бути видно без прокрутки вручну
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lines, step, typing]);

  // Esc закриває вікно — як будь-яке спливне вікно
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // В адмінці й на сторінці клієнта помічник зайвий: там є справжній чат
  if (pathname.startsWith("/admin") || pathname.startsWith("/moi-remonty")) return null;

  /** Таймер, який скасовує «Почати спочатку» — щоб стара репліка не з'явилась у новій розмові */
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const say = (text: string, delay = 0) => {
    setQueued((n) => n + 1);
    later(() => setTyping(true), delay);
    later(() => {
      setLines((l) => [...l, { from: "bot", text }]);
      setTyping(false);
      setQueued((n) => n - 1);
    }, delay + TYPING_MS);
  };

  const mine = (text: string) => setLines((l) => [...l, { from: "me", text }]);

  const pickSymptom = (s: Symptom) => {
    setSymptom(s);
    mine(s.label);
    say(s.reply);
    if (s.id === "other") {
      setStep("describe");
      return;
    }
    say(askModel, TYPING_MS + 100);
    setStep("model");
  };

  const pickModel = (value: string) => {
    setModel(value);
    mine(value);
    setStep("contacts");
    say(askContacts);
  };

  /** Відповідь своїми словами: опис поломки або модель, якої немає в списку */
  const submitDraft = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text.length < 2) {
      setError(step === "describe" ? "Напишіть хоча б кілька слів." : "Впишіть марку й модель.");
      return;
    }
    setDraft("");
    setError("");
    if (step === "describe") {
      setDetails(text);
      mine(text);
      setStep("model");
      say(askModel);
    } else {
      pickModel(text);
    }
  };

  const restart = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLines([{ from: "bot", text: greeting }]);
    setStep("symptom");
    setTyping(false);
    setQueued(0);
    setSymptom(null);
    setDetails("");
    setModel("");
    setDraft("");
    setError("");
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();

    if (!validName(cleanName)) {
      setError("Впишіть, будь ласка, імʼя — щоб майстер знав, як до вас звертатись.");
      return;
    }
    if (!phoneComplete(phone)) {
      setError("Перевірте номер телефону — здається, у ньому бракує цифр.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          phone: phone.trim(),
          model,
          service: symptom?.service ?? "",
          problem: ["Через помічника на сайті", symptom?.label, details].filter(Boolean).join(": "),
          source: "landing",
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setTelegram((await res.json().catch(() => null))?.telegram ?? null);

      mine(`${cleanName}, ${formatPhone(localDigits(phone))}`);
      setStep("sent");
      say(done);
    } catch {
      setError(`Не вдалося надіслати. Зателефонуйте, будь ласка: ${site.phones[0].label}`);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className={`${styles.launcher} accent-edge`} onClick={() => setOpen(true)} aria-label="Консультація" data-track="chat-open">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
        <span className={styles.launcherLabel}>Консультація</span>
      </button>
    );
  }

  return (
    <section className={styles.panel} aria-label="Консультація">
      <header className={styles.head}>
        <div className={styles.who}>
          <BotAvatar size={42} />
          <div>
            <div className={styles.title}>Іван</div>
            {/* Чесно кажемо, що це не людина */}
            <div className={styles.subtitle}>Бот-помічник · майстер передзвонить</div>
          </div>
        </div>

        <div className={styles.headActions}>
          <a href={site.phones[0].href} className={styles.iconBtn} aria-label={`Подзвонити: ${site.phones[0].label}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            </svg>
          </a>
          <button type="button" className={styles.iconBtn} onClick={() => setOpen(false)} aria-label="Закрити">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
          </button>
        </div>
      </header>

      <div className={styles.list} ref={listRef}>
        {lines.map((l, i) =>
          l.from === "me" ? (
            <div key={i} className={styles.me}>
              {l.text}
            </div>
          ) : (
            <div key={i} className={styles.botRow}>
              {/* Аватар — лише біля першої репліки з кількох поспіль, як у месенджерах */}
              {lines[i - 1]?.from === "bot" ? <span className={styles.avatarGap} /> : <BotAvatar size={30} />}
              <div className={styles.bot}>{l.text}</div>
            </div>
          ),
        )}

        {typing && (
          <div className={styles.botRow}>
            {lines[lines.length - 1]?.from === "bot" ? <span className={styles.avatarGap} /> : <BotAvatar size={30} />}
            <div className={styles.typing} aria-label="Іван друкує">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <div className={styles.foot}>
        {step === "symptom" && queued === 0 && (
          <div className={styles.chips}>
            {symptoms.map((s) => (
              <button key={s.id} type="button" className={styles.chip} onClick={() => pickSymptom(s)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {step === "model" && queued === 0 && (
          <div className={styles.chips}>
            {modelChips.map((m) => (
              <button key={m} type="button" className={styles.chip} onClick={() => pickModel(m)}>
                {m}
              </button>
            ))}
            <button type="button" className={styles.chip} onClick={() => setStep("modelText")}>
              Інша — впишу сам
            </button>
          </div>
        )}

        {(step === "describe" || step === "modelText") && queued === 0 && (
          <form className={styles.inline} onSubmit={submitDraft}>
            <label htmlFor="bot-draft" className="visually-hidden">
              {step === "describe" ? "Що сталося" : "Модель"}
            </label>
            <input
              id="bot-draft"
              className="field"
              type="text"
              autoFocus
              placeholder={step === "describe" ? "Наприклад: не працює динамік" : "Наприклад: Samsung A54"}
              value={draft}
              onChange={(e) => {
                // Опис — до 500 символів, модель — коротко; спецсимволи відкидаються
                setDraft(plainText(e.target.value, step === "describe" ? LIMITS.problem : LIMITS.short));
                setError("");
              }}
            />
            <button type="submit" className="btn btn-accent">
              Далі
            </button>
            <FormError>{error}</FormError>
          </form>
        )}

        {step === "contacts" && (
          <form className={styles.form} onSubmit={send}>
            <label htmlFor="bot-name" className="visually-hidden">
              Імʼя
            </label>
            <input
              id="bot-name"
              className="field"
              type="text"
              placeholder="Як до вас звертатись"
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(onlyLetters(e.target.value));
                setError("");
              }}
            />

            <label htmlFor="bot-phone" className="visually-hidden">
              Телефон
            </label>
            <PhoneInput
              id="bot-phone"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                setError("");
              }}
            />

            <FormError>{error}</FormError>

            <button type="submit" className="btn btn-accent btn-lg" disabled={sending}>
              {sending ? "Надсилаємо…" : "Хай передзвонять"}
            </button>
          </form>
        )}

        {step === "sent" && <TelegramConnect href={telegram} />}

        {step === "sent" && (
          <a href={site.phones[0].href} className="btn btn-ghost">
            Або подзвоніть самі: {site.phones[0].label}
          </a>
        )}

        {step !== "symptom" && (
          <button type="button" className={styles.restart} onClick={restart}>
            {step === "sent" ? "Нове питання" : "Почати спочатку"}
          </button>
        )}
      </div>
    </section>
  );
}
