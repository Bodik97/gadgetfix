"use client";

import { useState, useTransition } from "react";
import { saveList, saveText } from "./actions";
import styles from "./order.module.css";

/**
 * Поля картки, що зберігаються одразу: натиснув чип чи вийшов з поля —
 * і вже в базі. Кнопки «Зберегти» немає — нема що забути натиснути.
 */

const form = (id: string, entries: [string, string][]) => {
  const f = new FormData();
  f.set("id", id);
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

/** Набір чипів із кількома виборами (поломки, стан, комплект) */
export function ChipSet({
  id,
  field,
  options,
  value,
  label,
}: {
  id: string;
  field: "problems" | "condition" | "kit";
  options: readonly string[];
  value: string[];
  label: string;
}) {
  const [picked, setPicked] = useState(value);
  const [, start] = useTransition();

  function toggle(option: string) {
    const next = picked.includes(option) ? picked.filter((v) => v !== option) : [...picked, option];
    setPicked(next);
    start(() => saveList(form(id, [["field", field], ...next.map((v) => ["value", v] as [string, string])])));
  }

  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={picked.includes(o) ? styles.chipOn : styles.chip}
          aria-pressed={picked.includes(o)}
          onClick={() => toggle(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Текстове поле — зберігається, коли майстер виходить з нього */
export function TextField({
  id,
  field,
  value,
  label,
  hint,
  placeholder,
  multiline = false,
}: {
  id: string;
  field: "imei" | "diagnosis" | "masterNote" | "model" | "city";
  value: string | null;
  label: string;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [saved, setSaved] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputId = `f-${field}`;

  function save(text: string) {
    if (text.trim() === saved.trim() && !error) return;
    start(async () => {
      const res = await saveText(form(id, [["field", field], ["value", text]]));
      setError(res);
      if (!res) setSaved(text);
    });
  }

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
        {hint && <span className={styles.labelHint}> · {hint}</span>}
        {pending && <span className={styles.saving}> · зберігаю…</span>}
      </label>
      {multiline ? (
        <textarea
          id={inputId}
          className={styles.input}
          rows={3}
          maxLength={500}
          defaultValue={saved}
          placeholder={placeholder}
          onBlur={(e) => save(e.target.value)}
        />
      ) : (
        <input
          id={inputId}
          className={styles.input}
          defaultValue={saved}
          placeholder={placeholder}
          inputMode={field === "imei" ? "numeric" : undefined}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-invalid={error ? true : undefined}
          maxLength={field === "imei" ? 20 : 80}
        />
      )}
      {error && (
        <p role="alert" className={styles.inlineError}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Вибір одного з кількох — чипами (спосіб оплати, точка) */
export function OneOf<T extends string>({
  options,
  value,
  onPick,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onPick: (v: T) => void;
  label: string;
}) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? styles.chipOn : styles.chip}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Текст для Viber/копіювання: клієнт без Telegram отримує його від майстра вручну */
export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.message}>
      <p className={styles.messageText}>{text}</p>
      <button
        type="button"
        className={styles.ghostBtn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Буфер недоступний (старий браузер) — текст і так видно, його можна виділити
          }
        }}
      >
        {copied ? "Скопійовано ✓" : "Скопіювати для Viber"}
      </button>
    </div>
  );
}
