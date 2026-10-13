"use client";

import { normalizeUaPhone } from "@/lib/phone";

/**
 * Поле телефону з незмінним «+38».
 *
 * Людина одразу бачить, з чого починати, і вводить номер так, як звикла:
 * 073…, 73…, 8 073…, вставляє +380 73… чи 380 73… — усе зводиться до одного вигляду
 * «+38 073 123 45 67». У заявку йде «+380731234567».
 */

const PREFIX = "+38";

/** Те, що набрано чи вставлено → десять цифр номера, починаючи з нуля */
export function localDigits(raw: string): string {
  // Набрали перед «+38» (курсор стояв на початку поля) — це теж цифри номера, а не код країни
  const at = raw.indexOf(PREFIX);
  let d = (at >= 0 ? raw.slice(0, at) + raw.slice(at + PREFIX.length) : raw).replace(/\D/g, "");

  // Вставили номер повністю, з кодом країни — прибираємо «38»
  if (d.startsWith("380")) d = d.slice(2);
  // Залишок стертого префікса («+3», «+»): це ще не цифри номера
  else if (at < 0 && /^(38?|8)$/.test(d)) d = "";

  // Код країни набрали вдруге цифра за цифрою, після готового «+38»: нуль поле вже
  // підставило само, тож приходить «038…». Мобільних кодів на 038 немає — це не номер
  if (d.startsWith("038")) d = d.slice(3);
  // По-старому, через вісімку: «8 073…». Коду 080 теж немає — вісімка зайва
  d = d.replace(/^0?80/, "0");

  // Після +38 номер завжди починається з нуля — підставляємо, якщо почали з 73…
  if (d && d[0] !== "0") d = `0${d}`;
  return d.slice(0, 10);
}

/** 0731234567 → «+38 073 123 45 67»; неповний номер — скільки вже є */
export function formatPhone(local: string): string {
  const parts = [local.slice(0, 3), local.slice(3, 6), local.slice(6, 8), local.slice(8, 10)].filter(Boolean);
  return `${PREFIX} ${parts.join(" ")}`;
}

/** Номер набрано повністю, і це справжній український номер? */
export const phoneComplete = (value: string) => normalizeUaPhone(`${PREFIX}${localDigits(value)}`) !== null;

export default function PhoneInput({
  value,
  onChange,
  ...rest
}: {
  /** «+380731234567» або частина; порожній рядок — ще нічого не введено */
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  /**
   * Курсор не має стояти всередині «+38 »: набране там зламало б номер.
   * Виділення не чіпаємо — «виділити все й набрати заново» має працювати.
   */
  const keepCaretAfterPrefix = (el: HTMLInputElement) => {
    const from = PREFIX.length + 1;
    const start = el.selectionStart ?? from;
    if (start === el.selectionEnd && start < from) el.setSelectionRange(from, from);
  };

  return (
    <input
      className="field"
      {...rest}
      // Клік чи Tab ставлять курсор після події — тому на наступному кадрі
      onFocus={(e) => {
        const el = e.currentTarget;
        requestAnimationFrame(() => keepCaretAfterPrefix(el));
      }}
      onSelect={(e) => keepCaretAfterPrefix(e.currentTarget)}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={formatPhone(localDigits(value))}
      onChange={(e) => {
        const el = e.target;
        // Набирали в кінці — там курсор і має лишитись. Без цього після
        // вставленого пробілу він опинявся перед останньою цифрою, і номер плутався
        const typingAtEnd = el.selectionStart === el.value.length;

        const local = localDigits(el.value);
        onChange(local ? `${PREFIX}${local}` : "");

        if (typingAtEnd) requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
      }}
    />
  );
}
