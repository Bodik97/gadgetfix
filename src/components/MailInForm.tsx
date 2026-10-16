"use client";

import { useState } from "react";
import { bookingModels } from "@/data/landing";
import { site } from "@/data/site";
import FormError from "./FormError";
import styles from "./BookingForm.module.css";
import TelegramConnect from "@/components/TelegramConnect";
import PhoneInput from "./PhoneInput";
import FormField, { fieldState } from "./FormField";
import Logo from "./Logo";
import { LIMITS, nameProblem, onlyLetters, phoneProblem, placeProblem, plainText } from "@/lib/validate";

/** Що не так у кожному полі; порожньо — усе гаразд */
type Errors = { name?: string | null; phone?: string | null; city?: string | null; problem?: string | null };

export default function MailInForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [model, setModel] = useState("");
  const [problem, setProblem] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [telegram, setTelegram] = useState<string | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const fail = (patch: Errors) => setErrors((e) => ({ ...e, ...patch }));

  const reset = () => {
    setErrors({});
    setName("");
    setPhone("");
    setCity("");
    setModel("");
    setProblem("");
    setError("");
    setSent(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Errors = { name: nameProblem(name), phone: phoneProblem(phone), city: placeProblem(city) };
    setErrors(found);
    // Курсор — у перше поле з помилкою, щоб не шукати його очима
    const first = found.name ? "p-name" : found.phone ? "p-phone" : found.city ? "p-city" : null;
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, city, model, problem, source: "mail-in" }),
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

  if (sent) {
    return (
      <div className={styles.box}>
        <div className={styles.done}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" />
          </svg>
          <h3>Заявку прийнято</h3>
          <p className={styles.doneText}>
            Передзвонимо протягом 25 хвилин у робочі години й назвемо адресу відділення та номер замовлення.
          </p>
          <TelegramConnect href={telegram} />
          <button type="button" onClick={reset} className="btn btn-ghost">
            Оформити ще одну
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.box}>
      <div className={styles.brand}>
        <Logo as="text" />
      </div>

      <form onSubmit={submit} className={styles.form} noValidate>
        <p className={styles.sub}>
          Потрібні імʼя, телефон і відділення Нової Пошти. Модель і опис — за бажанням.
        </p>

        <FormField
          id="p-name"
          label="Ім'я та прізвище"
          hint="Лише літери — як у документі, за яким забиратимете посилку."
          error={errors.name}
        >
          <input
            {...fieldState("p-name", errors.name)}
            type="text"
            autoComplete="name"
            placeholder="Наприклад: Олена Коваль"
            value={name}
            maxLength={LIMITS.name.max}
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

        <FormField id="p-phone" label="Телефон" hint="Після +38 починайте з нуля: 073 123 45 67." error={errors.phone}>
          <PhoneInput
            {...fieldState("p-phone", errors.phone)}
            value={phone}
            onChange={(v) => {
              setPhone(v);
              if (errors.phone) fail({ phone: phoneProblem(v) });
            }}
            onBlur={() => phone && fail({ phone: phoneProblem(phone) })}
          />
        </FormField>

        <FormField
          id="p-city"
          label="Місто й відділення"
          hint="Куди повернути пристрій після ремонту."
          error={errors.city}
        >
          <input
            {...fieldState("p-city", errors.city)}
            type="text"
            placeholder="Наприклад: Тернопіль, відділення 12"
            value={city}
            maxLength={LIMITS.place.max}
            onChange={(e) => {
              setCity(plainText(e.target.value, LIMITS.place.max));
              if (errors.city) fail({ city: placeProblem(e.target.value) });
            }}
            onBlur={() => city && fail({ city: placeProblem(city) })}
          />
        </FormField>

        <div className={styles.row}>
          <label htmlFor="p-model">Модель</label>
          <select id="p-model" className="field" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Оберіть модель</option>
            {bookingModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <FormField
          id="p-issue"
          label="Що трапилось"
          hint="Необовʼязково. Кілька слів: що зламалось і коли."
          error={errors.problem}
          counter={`${problem.length} / ${LIMITS.problem}`}
        >
          <textarea
            {...fieldState("p-issue", errors.problem)}
            className={`${fieldState("p-issue", errors.problem).className} ${styles.textarea}`}
            placeholder="Наприклад: не тримає заряд, розбите скло спинки"
            value={problem}
            maxLength={LIMITS.problem}
            onChange={(e) => {
              const clean = plainText(e.target.value, LIMITS.problem, true);
              setProblem(clean);
              fail({
                problem:
                  clean.length < e.target.value.trimStart().length && clean.length < LIMITS.problem
                    ? "Спецсимволи й емодзі тут не потрібні — лишили звичайний текст."
                    : null,
              });
            }}
          />
        </FormField>

        <FormError>{error}</FormError>

        <button type="submit" className="btn btn-accent btn-lg" disabled={sending}>
          {sending ? "Надсилаємо…" : "Оформити відправку"}
        </button>

        <p className={styles.note}>
          Передзвонимо до 25 хвилин у робочий час і підкажемо, як надіслати. Діагностика
          безкоштовна.{" "}
          <a href="/personalni-dani" target="_blank" rel="noopener">
            Як ми зберігаємо дані
          </a>
        </p>
      </form>
    </div>
  );
}
