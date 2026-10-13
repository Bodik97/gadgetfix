"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import FormError from "@/components/FormError";
import styles from "./SignInForm.module.css";

/** credentials — пошта+пароль; code — підтвердження пошти при реєстрації; codeLogin — вхід без пароля */
type Step = "credentials" | "code" | "codeLogin";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const MIN_PASSWORD = 8;

/** Код помилки Clerk лежить у різних місцях залежно від методу — дістаємо звідусіль */
function errorCode(error: unknown): string {
  const e = error as { code?: string; errors?: { code?: string }[] } | null;
  // Спершу конкретний код від API: у ClerkAPIResponseError власне поле code
  // завжди "api_response_error" і затуляло б справжню причину
  return e?.errors?.[0]?.code ?? e?.code ?? "";
}

type Props = {
  /** Викликається після успішного входу — модальному вікну треба закритись */
  onDone?: () => void;
  /** У модальному вікні картка вже має свою рамку — друга не потрібна */
  bare?: boolean;
};

export default function SignInForm({ onDone, bare }: Props = {}) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Код просили після правильного пароля (новий пристрій): тоді signIn скидати не можна
  const [afterPassword, setAfterPassword] = useState(false);

  const goToAccount = () => {
    onDone?.();
    router.push("/moi-remonty");
    // Сторінка «Мої ремонти» рендериться на сервері й має побачити нову сесію
    router.refresh();
  };

  /** Вхід паролем; якщо акаунта немає — реєструємо з цим же паролем */
  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim();

    if (!EMAIL_RE.test(mail)) {
      setError("Перевірте адресу пошти — здається, у ній помилка.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Пароль має бути щонайменше ${MIN_PASSWORD} символів.`);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { error: signInError } = await signIn.password({ identifier: mail, password });

      if (!signInError) {
        if (signIn.status === "complete") {
          await signIn.finalize({ navigate: goToAccount });
          return;
        }

        // Пароль правильний, але Clerk хоче підтвердити пристрій (needs_client_trust)
        // або другий фактор. Єдиний спосіб, який ми підтримуємо, — код на пошту.
        const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: mail });
        if (sendError) {
          setError("Не вдалося увійти. Спробуйте кодом на пошту або зателефонуйте нам.");
          return;
        }

        setIsNew(false);
        setAfterPassword(true);
        setNotice("Ви входите з нового пристрою. Надіслали код на пошту — введіть його, щоб підтвердити, що це ви.");
        setStep("codeLogin");
        return;
      }

      const code = errorCode(signInError);

      // Вже є активна сесія — просто ведемо на сторінку ремонтів
      if (code === "session_exists" || errorCode(signInError) === "session_exists") {
        goToAccount();
        return;
      }

      // Пароль не підходить до наявного акаунта — реєструвати не можна
      if (code === "form_password_incorrect") {
        setError("Пароль не підходить. Спробуйте ще раз або увійдіть кодом на пошту.");
        return;
      }

      // Акаунт є, але пароля в нього немає: реєструвався до того, як ми ввели паролі.
      // Пускаємо кодом — пароль він задасть у себе на сторінці.
      if (code && code !== "form_identifier_not_found") {
        // Після невдалої спроби signIn лишається у стані помилки — інакше код не надішлеться
        signIn.reset();
        const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: mail });
        if (sendError) {
          setError("Не вдалося увійти. Спробуйте кодом на пошту або зателефонуйте нам.");
          return;
        }
        setIsNew(false);
        setAfterPassword(false);
        setNotice("Ви реєструвались раніше, коли паролів ще не було. Надіслали код — увійдіть, і задасте пароль у себе на сторінці.");
        setStep("codeLogin");
        return;
      }

      // Такого клієнта немає — створюємо разом із паролем
      const created = await signUp.create({
        emailAddress: mail,
        password,
        ...(name.trim() ? { firstName: name.trim() } : {}),
      });

      if (created?.error) {
        const createCode = errorCode(created.error);
        setError(
          createCode === "form_password_pwned"
            ? "Цей пароль засвітився у витоках даних. Придумайте інший."
            : createCode === "form_password_length_too_short"
              ? `Пароль має бути щонайменше ${MIN_PASSWORD} символів.`
              : "Не вдалося створити акаунт. Спробуйте увійти кодом на пошту.",
        );
        return;
      }

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) throw sendError;

      setIsNew(true);
      setStep("code");
    } catch {
      setError("Не вдалося увійти. Спробуйте ще раз або зателефонуйте нам.");
    } finally {
      setBusy(false);
    }
  };

  /** Запасний шлях: разовий код замість пароля */
  const sendLoginCode = async () => {
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) {
      setError("Спершу впишіть пошту — надішлемо на неї код.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      signIn.reset();
      const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: mail });
      if (sendError) {
        setError("Такої пошти в нас немає. Впишіть пароль — і створимо вам акаунт.");
        return;
      }
      setIsNew(false);
      setAfterPassword(false);
      setStep("codeLogin");
    } catch {
      setError("Не вдалося надіслати код. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  };

  /** Лист не дійшов або код не підійшов — надсилаємо ще раз тим самим способом, що й уперше */
  const resendCode = async () => {
    setBusy(true);
    setError("");
    try {
      if (isNew) {
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) throw sendError;
      } else {
        if (!afterPassword) signIn.reset();
        const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
        if (sendError) throw sendError;
      }
      setCode("");
      setNotice("Надіслали код ще раз. Вводьте той, що в найновішому листі.");
    } catch {
      setError("Не вдалося надіслати код. Спробуйте ще раз за хвилину або зателефонуйте нам.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) {
      setError("Код складається з 6 цифр.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (isNew) {
        await signUp.verifications.verifyEmailCode({ code: code.trim() });
        if (signUp.status !== "complete") throw new Error("incomplete");
        await signUp.finalize({ navigate: goToAccount });
      } else {
        await signIn.emailCode.verifyCode({ code: code.trim() });
        if (signIn.status !== "complete") throw new Error("incomplete");
        await signIn.finalize({ navigate: goToAccount });
      }
    } catch {
      setError("Код не підійшов. Перевірте останній лист або надішліть код ще раз.");
      setBusy(false);
    }
  };

  const restart = () => {
    setStep("credentials");
    setCode("");
    setError("");
    setNotice("");
    setIsNew(false);
  };

  if (step === "code" || step === "codeLogin") {
    return (
      <div className={bare ? styles.cardBare : styles.card}>
        <form onSubmit={verifyCode} className={styles.form} noValidate>
          {notice && <div className={styles.notice}>{notice}</div>}

          <p className={styles.sentTo}>
            {isNew ? "Підтвердіть пошту — надіслали код на " : "Надіслали код на "}
            <strong>{email}</strong>
          </p>

          <div className={styles.row}>
            <label htmlFor="v-code">Код із листа</label>
            <input
              id="v-code"
              className={`field ${styles.codeField}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="······"
              value={code}
              autoFocus
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
            />
            <span className={styles.hint}>Лист іде до хвилини. Гляньте теку «Спам», якщо не видно.</span>
          </div>

          <FormError>{error}</FormError>

          <button type="submit" className="btn btn-accent btn-lg" disabled={busy}>
            {busy ? "Перевіряємо…" : isNew ? "Завершити реєстрацію" : "Увійти"}
          </button>

          <div className={styles.actions}>
            <button type="button" className={styles.linkBtn} onClick={resendCode} disabled={busy}>
              Надіслати код ще раз
            </button>
            <button type="button" className={styles.linkBtn} onClick={restart} disabled={busy}>
              Назад
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={bare ? styles.cardBare : styles.card}>
      <form onSubmit={submitCredentials} className={styles.form} noValidate>
        <div className={styles.row}>
          <label htmlFor="v-email">Пошта</label>
          <input
            id="v-email"
            className="field"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className={styles.row}>
          <label htmlFor="v-password">Пароль</label>
          <input
            id="v-password"
            className="field"
            type="password"
            autoComplete="current-password"
            placeholder="Щонайменше 8 символів"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
          <span className={styles.hint}>
            Заходите вперше? Впишіть пароль, який хочете — створимо акаунт.
          </span>
        </div>

        <div className={styles.row}>
          <label htmlFor="v-name">Ім&apos;я — якщо заходите вперше</label>
          <input
            id="v-name"
            className="field"
            type="text"
            autoComplete="given-name"
            placeholder="Як до вас звертатись"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <FormError>{error}</FormError>

        {/* Сюди Clerk монтує Smart CAPTCHA — без цього елемента він падає на invisible-варіант */}
        <div id="clerk-captcha" />

        <button type="submit" className="btn btn-accent btn-lg" disabled={busy}>
          {busy ? "Заходимо…" : "Увійти"}
        </button>

        <div className={styles.actions}>
          <button type="button" className={styles.linkBtn} onClick={sendLoginCode} disabled={busy}>
            Забули пароль? Увійти кодом на пошту
          </button>
        </div>

        <p className={styles.note}>Адресу використовуємо лише для входу й сповіщень про ремонт.</p>
      </form>
    </div>
  );
}
