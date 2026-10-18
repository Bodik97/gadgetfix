"use client";

import { Suspense, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { site } from "@/data/site";
import FormError from "./FormError";
import FormField, { fieldState } from "./FormField";
import Logo from "./Logo";
import PhoneInput from "./PhoneInput";
import TelegramConnect from "./TelegramConnect";
import { LIMITS, nameProblem, onlyLetters, phoneProblem, plainText } from "@/lib/validate";
import styles from "./BookingForm.module.css";

export type LeadSource = "landing" | "model" | "services" | "mail-in";

type Props = {
  source: LeadSource;
  /** Випадний список: моделі на лендінгу, послуги на /poslugy */
  select?: { name: "model" | "service"; label: string; placeholder: string; options: string[] };
  /** Модель уже відома (сторінка моделі) — списку немає, значення йде в заявку як є */
  model?: string;
  submitLabel?: string;
  /** Початковий вибір, коли він відомий наперед — напр. у вікні запису */
  initialChoice?: string;
  /** У модальному вікні рамку дає саме вікно — друга не потрібна */
  bare?: boolean;
  /** Форма з кнопки: лише імʼя й телефон, решта — за посиланням «Додати деталі» */
  simple?: boolean;
  /** Підзаголовок над полями форми на сторінці: що вписати й що буде далі */
  subtitle?: string;
  /** Скільки символів дозволено в «Що трапилось»; за замовчуванням — спільний ліміт */
  problemMax?: number;
};

/** Що не так у кожному полі; порожньо — усе гаразд */
type Errors = { name?: string | null; phone?: string | null; problem?: string | null };

function BookingFormInner({
  source,
  select,
  model,
  submitLabel = "Записатись на безкоштовну діагностику",
  initialChoice = "",
  bare,
  simple = false,
  subtitle = "Впишіть імʼя й телефон — передзвонимо до 25 хвилин. Модель і опис допоможуть одразу назвати ціну.",
  problemMax = LIMITS.problem,
}: Props & { initialChoice?: string }) {
  // Форма буває на сторінці двічі — у тексті й у вікні запису; з однаковими id
  // підпис поля у вікні вів би до поля під ним
  const uid = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [choice, setChoice] = useState(initialChoice);
  const [problem, setProblem] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [telegram, setTelegram] = useState<string | null>(null);
  // Обовʼязкові лише імʼя й телефон. У простій формі решта ховається, щоб не
  // лякати; відкрита одразу, коли послугу вже обрали кнопкою на сайті
  const [details, setDetails] = useState(!simple || Boolean(initialChoice));

  const fail = (patch: Errors) => setErrors((e) => ({ ...e, ...patch }));

  const reset = () => {
    setName("");
    setPhone("");
    setChoice("");
    setProblem("");
    setErrors({});
    setError("");
    setSent(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found: Errors = { name: nameProblem(name), phone: phoneProblem(phone) };
    setErrors(found);
    // Курсор — у перше поле з помилкою, щоб не шукати його очима
    const first = found.name ? "name" : found.phone ? "phone" : null;
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          problem,
          source,
          ...(select ? { [select.name]: choice } : {}),
          ...(model ? { model } : {}),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setTelegram((await res.json().catch(() => null))?.telegram ?? null);
      setSent(true);
    } catch {
      setError("Не вдалося надіслати. Зателефонуйте, будь ласка: " + site.phones[0].label);
    } finally {
      setSending(false);
    }
  };

  // Логотип — над кожною формою: людина бачить, кому лишає номер.
  // У вікні запису він стоїть над заголовком вікна, тож тут не повторюється
  const brand = bare ? null : (
    <div className={styles.brand}>
      <Logo as="text" />
    </div>
  );

  if (sent) {
    return (
      <div className={bare ? styles.boxBare : styles.box}>
        {brand}
        {/* data-sent — вікно запису ховає за ним свій заголовок «Залиште номер» */}
        <div className={styles.done} data-sent="">
          <svg className={styles.doneMark} width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" pathLength="1" />
            <path d="M8 12.5l2.5 2.5L16 9.5" pathLength="1" />
          </svg>
          <h3>Заявку прийнято</h3>
          <p className={styles.doneText}>
            Передзвонимо протягом 25&nbsp;хвилин у&nbsp;робочі години. Якщо терміново&nbsp;—{" "}
            <a href={site.phones[0].href} className={styles.donePhone}>
              {site.phones[0].label}
            </a>
            .
          </p>
          <TelegramConnect href={telegram} />
          <button type="button" onClick={reset} className="btn btn-ghost">
            Надіслати ще одну
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={bare ? styles.boxBare : styles.box}>
      {brand}

      <form onSubmit={submit} className={styles.form} noValidate>
        {!bare && <p className={styles.sub}>{subtitle}</p>}

        <FormField id={`${uid}-name`} label="Ім'я" hint="Лише літери&nbsp;— так, як до вас звертатись." error={errors.name}>
          <input
            {...fieldState(`${uid}-name`, errors.name)}
            type="text"
            autoComplete="name"
            placeholder="Наприклад: Олена"
            maxLength={LIMITS.name.max}
            value={name}
            onChange={(e) => {
              const clean = onlyLetters(e.target.value);
              setName(clean);
              // Набрали цифру чи знак — кажемо чому вони не зʼявились, а не мовчки ковтаємо
              fail({
                name:
                  clean !== e.target.value
                    ? "У цьому полі — лише літери, без цифр і знаків."
                    : errors.name
                      ? nameProblem(clean)
                      : null,
              });
            }}
            onBlur={() => name && fail({ name: nameProblem(name) })}
          />
        </FormField>

        <FormField
          id={`${uid}-phone`}
          label="Телефон"
          hint="Після +38 починайте з&nbsp;нуля: 073&nbsp;123&nbsp;45&nbsp;67."
          error={errors.phone}
        >
          <PhoneInput
            {...fieldState(`${uid}-phone`, errors.phone)}
            value={phone}
            onChange={(v) => {
              setPhone(v);
              // Помилку прибираємо, щойно номер став правильним, — але не лаємо, поки людина ще набирає
              if (errors.phone) fail({ phone: phoneProblem(v) });
            }}
            onBlur={() => phone && fail({ phone: phoneProblem(phone) })}
          />
        </FormField>

        {!details && (
          <button type="button" className={styles.more} onClick={() => setDetails(true)}>
            Додати деталі — необов&apos;язково
          </button>
        )}

        {details && select && (
          <div className={styles.row}>
            <label htmlFor={`${uid}-choice`}>{select.label}</label>
            <select
              id={`${uid}-choice`}
              className="field"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">{select.placeholder}</option>
              {select.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        )}

        {details && (
          <FormField
            id={`${uid}-problem`}
            label="Що трапилось"
            hint="Необовʼязково. Кілька слів: що зламалось і коли."
            error={errors.problem}
            counter={`${problem.length} / ${problemMax}`}
          >
            <textarea
              {...fieldState(`${uid}-problem`, errors.problem)}
              className={`${fieldState(`${uid}-problem`, errors.problem).className} ${styles.textarea}`}
              placeholder="Наприклад: розбитий екран, не тримає заряд"
              value={problem}
              maxLength={problemMax}
              onChange={(e) => {
                const clean = plainText(e.target.value, problemMax, true);
                setProblem(clean);
                fail({
                  problem:
                    clean.length < e.target.value.trimStart().length && clean.length < problemMax
                      ? "Спецсимволи й емодзі тут не потрібні — лишили звичайний текст."
                      : null,
                });
              }}
            />
          </FormField>
        )}

        <FormError>{error}</FormError>

        <button type="submit" className="btn btn-accent btn-lg" disabled={sending}>
          {sending ? "Надсилаємо…" : submitLabel}
        </button>

        <p className={styles.note}>
          Передзвонимо до 25&nbsp;хвилин у&nbsp;робочий час. Діагностика безкоштовна.{" "}
          <a href="/personalni-dani" target="_blank" rel="noopener">
            Як ми зберігаємо дані
          </a>
        </p>
      </form>
    </div>
  );
}

/** Дістає вибір із адреси: ?service=… або ?model=… від картки на сайті */
function BookingFormWithChoice(props: Props) {
  const params = useSearchParams();
  // Значення з властивості важливіше за адресу: вікно відкрили з конкретної кнопки
  const choice = props.initialChoice || (props.select ? (params.get(props.select.name) ?? "") : "");
  return <BookingFormInner {...props} initialChoice={choice} />;
}

export default function BookingForm(props: Props) {
  // Запасний варіант — та сама форма без підстановки. Так розмітка потрапляє
  // в статичний пререндер, а підстановка додається вже на клієнті.
  return (
    <Suspense fallback={<BookingFormInner {...props} />}>
      <BookingFormWithChoice {...props} />
    </Suspense>
  );
}
