"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import FormError from "../FormError";
import styles from "./SetPassword.module.css";

const MIN_PASSWORD = 8;

/**
 * Показується тим, хто реєструвався до введення паролів, — щоб наступного разу
 * вони заходили без коду на пошту.
 */
export default function SetPassword() {
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Пароль уже є — нагадувати нема про що
  if (!isLoaded || user?.passwordEnabled || done) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD) {
      setError(`Пароль має бути щонайменше ${MIN_PASSWORD} символів.`);
      return;
    }
    if (password !== repeat) {
      setError("Паролі не збігаються.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await user?.updatePassword({ newPassword: password });
      setDone(true);
    } catch (err) {
      const code = (err as { errors?: { code?: string }[] })?.errors?.[0]?.code;
      setError(
        code === "form_password_pwned"
          ? "Цей пароль засвітився у витоках даних. Придумайте інший."
          : "Не вдалося зберегти пароль. Спробуйте ще раз.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className={styles.offer}>
        <div>
          <div className={styles.offerTitle}>Задайте пароль</div>
          <p className={styles.offerText}>
            Ви входите кодом на пошту. Задайте пароль — і наступного разу зайдете швидше.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
          Задати пароль
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className={styles.form} noValidate>
      <div className={styles.row}>
        <label htmlFor="sp-new">Новий пароль</label>
        <input
          id="sp-new"
          className="field"
          type="password"
          autoComplete="new-password"
          placeholder="Щонайменше 8 символів"
          value={password}
          autoFocus
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="sp-repeat">Ще раз</label>
        <input
          id="sp-repeat"
          className="field"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => {
            setRepeat(e.target.value);
            setError("");
          }}
        />
      </div>

      <FormError>{error}</FormError>

      <div className={styles.actions}>
        <button type="submit" className="btn btn-accent" disabled={busy}>
          {busy ? "Зберігаємо…" : "Зберегти"}
        </button>
        <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={busy}>
          Пізніше
        </button>
      </div>
    </form>
  );
}
