"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import FormError from "@/components/FormError";
import { enterAdmin, prepareAdminSignIn } from "../actions";
import styles from "./page.module.css";

/**
 * Вхід майстра без пароля: пошта → код із листа → адмінка.
 * Лист і перевірку коду робить Clerk, а пускати чи ні — вирішує сервер (enterAdmin).
 */
export default function SignInForm() {
  const { signIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const problem = await prepareAdminSignIn(email);
    if (problem) {
      setError(problem);
      return false;
    }
    // Увійшов у кабінет клієнта на цьому телефоні — Clerk не почне новий вхід поверх
    if (isSignedIn) await signOut();
    signIn.reset();
    const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
    if (sendError) {
      setError("Не вдалося надіслати код. Перевірте пошту й спробуйте ще раз.");
      return false;
    }
    return true;
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (await sendCode()) {
        setNotice(`Надіслали 6 цифр на ${email.trim()}. Лист іде до хвилини — гляньте й у «Спам».`);
        setStep("code");
      }
    } catch {
      setError("Не вдалося надіслати код. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      if (await sendCode()) {
        setCode("");
        setNotice("Надіслали ще раз. Вводьте код із найновішого листа.");
      }
    } catch {
      setError("Не вдалося надіслати код. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn.emailCode.verifyCode({ code: code.trim() });
      if (signIn.status !== "complete") {
        setError("Код не підійшов. Перевірте останній лист або надішліть код ще раз.");
        setBusy(false);
        return;
      }
      await signIn.finalize();
      const problem = await enterAdmin();
      // Сесія Clerk потрібна була лише щоб довести пошту — в адмінці живе наша cookie
      await signOut();
      if (problem) {
        setError(problem);
        setBusy(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Не вдалося увійти. Спробуйте ще раз.");
      setBusy(false);
    }
  };

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className={styles.form}>
        <p className={styles.hint}>{notice}</p>
        <div className={styles.row}>
          <label htmlFor="a-code">Код із листа</label>
          <input
            id="a-code"
            name="code"
            className={`field ${styles.code}`}
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
        </div>

        <FormError>{error}</FormError>

        <button type="submit" className="btn btn-accent btn-lg" disabled={busy}>
          {busy ? "Перевіряємо…" : "Увійти"}
        </button>
        <button type="button" className={styles.back} onClick={resend} disabled={busy}>
          Надіслати код ще раз
        </button>
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            setStep("email");
            setCode("");
            setError("");
          }}
          disabled={busy}
        >
          Інша пошта
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitEmail} className={styles.form}>
      <div className={styles.row}>
        <label htmlFor="a-email">Пошта</label>
        <input
          id="a-email"
          name="email"
          type="email"
          className="field"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <FormError>{error}</FormError>

      <button type="submit" className="btn btn-accent btn-lg" disabled={busy}>
        {busy ? "Надсилаємо…" : "Надіслати код"}
      </button>
    </form>
  );
}
