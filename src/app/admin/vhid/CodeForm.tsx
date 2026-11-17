"use client";

import { useActionState } from "react";
import FormError from "@/components/FormError";
import { verifyCode } from "../actions";
import styles from "./page.module.css";

/** Другий крок входу: 6 цифр із додатка-автентифікатора на телефоні */
export default function CodeForm() {
  const [error, action, pending] = useActionState(verifyCode, null);

  return (
    <form action={action} className={styles.form}>
      <p className={styles.hint}>
        Відкрийте на телефоні Google Authenticator (або інший додаток для кодів) і введіть 6 цифр для «GadgetFix Адмін».
      </p>
      <div className={styles.row}>
        <label htmlFor="a-code">Код із додатка</label>
        <input
          id="a-code"
          name="code"
          className={`field ${styles.code}`}
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
        />
      </div>

      <FormError>{error}</FormError>

      <button type="submit" className="btn btn-accent btn-lg" disabled={pending}>
        {pending ? "Перевіряємо…" : "Підтвердити"}
      </button>
      <a href="/admin/vhid" className={styles.back}>
        Увійти з іншим акаунтом
      </a>
    </form>
  );
}
