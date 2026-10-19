"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import FormError from "@/components/FormError";
import { startsWithSignUp } from "./authStore";
import styles from "./SignInForm.module.css";

/** credentials — пошта+пароль; code — підтвердження пошти при реєстрації; codeLogin — вхід без пароля */
type Step = "credentials" | "code" | "codeLogin";
/** Вкладка: вхід у наявний акаунт чи створення нового */
type Mode = "signin" | "signup";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const NEED_CONSENT = "Позначте згоду на обробку персональних даних — без неї не можемо створити кабінет.";
const MIN_PASSWORD = 8;

type FieldErrors = { email?: string; password?: string; agree?: string };

/** Помилка під полем; id збігається з aria-describedby поля */
function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <span id={`${id}-note`} className={styles.fieldError} role="alert">
      {text}
    </span>
  );
}

/** Стан поля для стилю й читача екрана: червона рамка й посилання на помилку */
const invalid = (id: string, text?: string) =>
  text ? ({ "aria-invalid": true, "aria-describedby": `${id}-note` } as const) : {};

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
  const [mode, setMode] = useState<Mode>(() => (startsWithSignUp() ? "signup" : "signin"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Помилки під конкретними полями — щоб було видно, що саме виправити
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  // Згода на обробку персональних даних — обовʼязкова для будь-якого способу входу
  const [agree, setAgree] = useState(false);
  // Код просили після правильного пароля (новий пристрій): тоді signIn скидати не можна
  const [afterPassword, setAfterPassword] = useState(false);

  const goToAccount = () => {
    onDone?.();
    router.push("/kabinet");
    // Сторінка «Мої ремонти» рендериться на сервері й має побачити нову сесію
    router.refresh();
  };

  // Щойно зареєструвався — одразу у форму замовлення, де чекає знижка 5%
  const goToWelcome = () => {
    onDone?.();
    router.push("/moi-remonty?vitayemo=1");
    router.refresh();
  };

  /** Вхід паролем; якщо акаунта немає — реєструємо з цим же паролем */
  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim();

    const found: FieldErrors = {
      email: !mail
        ? "Впишіть пошту — на неї прийде код."
        : EMAIL_RE.test(mail)
          ? undefined
          : "Перевірте адресу пошти — здається, у ній помилка.",
      password: !password
        ? mode === "signup"
          ? `Придумайте пароль — щонайменше ${MIN_PASSWORD} символів.`
          : "Впишіть пароль."
        : password.length < MIN_PASSWORD
          ? `Пароль має бути щонайменше ${MIN_PASSWORD} символів.`
          : undefined,
      agree: mode === "signup" && !agree ? NEED_CONSENT : undefined,
    };
    const first = (["email", "password", "agree"] as const).find((k) => found[k]);
    setFieldErrors(found);
    setError("");
    if (first) {
      document.getElementById(`v-${first}`)?.focus();
      return;
    }
    if (mode === "signup") {
      await register(mail);
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

      // Clerk відповів так, що код не розібрати, — не кажемо «акаунта немає», бо це може бути неправдою
      if (!code) {
        console.error("[signIn] невідома помилка Clerk:", signInError);
        setError("Не вдалося увійти. Спробуйте ще раз або увійдіть кодом на пошту.");
        return;
      }

      // Акаунт є, але пароля в нього немає: реєструвався до того, як ми ввели паролі.
      // Пускаємо кодом — пароль він задасть у себе на сторінці.
      if (code !== "form_identifier_not_found") {
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

      // Такого клієнта немає — пропонуємо вкладку «Реєстрація», пошту й пароль не губимо
      setError("Акаунта з такою поштою ще немає. Перейдіть на «Реєстрація» — дані вже вписані.");
    } catch {
      setError("Не вдалося увійти. Спробуйте ще раз або зателефонуйте нам.");
    } finally {
      setBusy(false);
    }
  };

  /** Новий акаунт: пошта, пароль, імʼя й обовʼязкова згода; далі — код на пошту */
  const register = async (mail: string) => {
    setBusy(true);
    setError("");
    try {
      const created = await signUp.create({
        emailAddress: mail,
        password,
        ...(name.trim() ? { firstName: name.trim() } : {}),
        // Галочка згоди обовʼязкова — Clerk збереже дату згоди в акаунті (legalAcceptedAt)
        legalAccepted: true,
      });

      if (created?.error) {
        const createCode = errorCode(created.error);
        // Людина вже з нами — перемикаємо на «Вхід», пошту й пароль не губимо
        if (createCode === "form_identifier_exists") {
          setMode("signin");
          setNotice("Ви вже з нами! Натисніть «Увійти» — якщо знижку ще не використано, вона чекає в кабінеті.");
          return;
        }
        setError(
          createCode === "form_password_pwned"
              ? "Цей пароль засвітився у витоках даних. Придумайте інший."
              : createCode === "form_password_length_too_short"
                ? `Пароль має бути щонайменше ${MIN_PASSWORD} символів.`
                : "Не вдалося створити акаунт. Спробуйте ще раз або зателефонуйте нам.",
        );
        return;
      }

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) throw sendError;

      setIsNew(true);
      setStep("code");
    } catch {
      setError("Не вдалося створити акаунт. Спробуйте ще раз або зателефонуйте нам.");
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
        setError("Такої пошти в нас немає. Перейдіть на «Реєстрація».");
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

  /** Вхід через Google: Clerk веде на Google і повертає на /sso-callback, звідти — у кабінет */
  const signInWithGoogle = async () => {
    // На вкладці «Вхід» згода — рядком під кнопкою; на «Реєстрації» — галочкою
    if (mode === "signup" && !agree) {
      setError(NEED_CONSENT);
      return;
    }
    setBusy(true);
    setError("");
    const { error: ssoError } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: mode === "signup" ? "/moi-remonty?vitayemo=1" : "/kabinet",
      redirectCallbackUrl: "/sso-callback",
    });
    if (ssoError) {
      setError("Не вдалося відкрити вхід через Google. Спробуйте ще раз або увійдіть поштою.");
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
        await signUp.finalize({ navigate: goToWelcome });
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
            {isNew ? "Майже готово! Введіть код із листа — і знижка ваша. Надіслали на " : "Надіслали код на "}
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
            {busy ? "Перевіряємо…" : isNew ? "Активувати −5%" : "Увійти"}
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

  const switchTo = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
    setFieldErrors({});
  };

  return (
    <div className={bare ? styles.cardBare : styles.card}>
      <div className={styles.tabs} role="tablist" aria-label="Вхід чи реєстрація">
        <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? styles.tabOn : styles.tab} onClick={() => switchTo("signin")}>
          Вхід
        </button>
        <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? styles.tabOn : styles.tab} onClick={() => switchTo("signup")}>
          Реєстрація
        </button>
      </div>

      <form onSubmit={submitCredentials} className={styles.form} noValidate>
        {mode === "signup" && (
          <div className={styles.bonus}>
            <strong>−5%</strong>
            <span>на перший ремонт — одразу після реєстрації</span>
          </div>
        )}

        {notice && <div className={styles.notice}>{notice}</div>}

        {mode === "signup" && (
          <div className={styles.row}>
            <label htmlFor="v-name">
              Імʼя <span className={styles.optional}>— не обовʼязково</span>
            </label>
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
        )}

        <div className={styles.row}>
          <label htmlFor="v-email">Пошта</label>
          <input
            id="v-email"
            className={fieldErrors.email ? "field field-invalid" : "field"}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            {...invalid("v-email", fieldErrors.email)}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
              setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
          />
          <FieldError id="v-email" text={fieldErrors.email} />
        </div>

        <div className={styles.row}>
          <label htmlFor="v-password">Пароль</label>
          <div className={styles.passWrap}>
            <input
              id="v-password"
              className={fieldErrors.password ? "field field-invalid" : "field"}
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="Щонайменше 8 символів"
              value={password}
              {...invalid("v-password", fieldErrors.password)}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
                setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
            />
            <button
              type="button"
              className={styles.passToggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Сховати пароль" : "Показати пароль"}
              aria-pressed={showPassword}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="M4 4l16 16" />}
              </svg>
            </button>
          </div>
          <FieldError id="v-password" text={fieldErrors.password} />
        </div>

        {mode === "signup" && (
          <label className={styles.consent}>
            <input
              id="v-agree"
              type="checkbox"
              checked={agree}
              {...invalid("v-agree", fieldErrors.agree)}
              onChange={(e) => {
                setAgree(e.target.checked);
                setError("");
                setFieldErrors((f) => ({ ...f, agree: undefined }));
              }}
            />
            <span>
              Погоджуюсь з{" "}
              <a href="/personalni-dani" target="_blank" rel="noopener">
                обробкою персональних даних
              </a>
            </span>
          </label>
        )}
        {mode === "signup" && <FieldError id="v-agree" text={fieldErrors.agree} />}

        <FormError>{error}</FormError>

        {/* Сюди Clerk монтує Smart CAPTCHA — без цього елемента він падає на invisible-варіант */}
        <div id="clerk-captcha" />

        <button type="submit" className="btn btn-accent btn-lg" disabled={busy}>
          {busy ? (mode === "signup" ? "Створюємо…" : "Заходимо…") : mode === "signup" ? "Зареєструватись і отримати −5%" : "Увійти"}
        </button>

        <div className={styles.or} aria-hidden="true">
          <span>або</span>
        </div>

        <button type="button" className={`btn btn-ghost btn-lg ${styles.google}`} onClick={signInWithGoogle} disabled={busy}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
            <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5z" />
            <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z" />
            <path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z" />
          </svg>
          {mode === "signup" ? "Через Google" : "Увійти через Google"}
        </button>

        {mode === "signin" ? (
          <>
            <button type="button" className={styles.linkBtn} onClick={sendLoginCode} disabled={busy}>
              Забули пароль? Увійти кодом на пошту
            </button>
            {/* Google може створити акаунт і з цієї вкладки — тому згода й тут */}
            <p className={styles.note}>
              Продовжуючи, ви погоджуєтесь з{" "}
              <a href="/personalni-dani" target="_blank" rel="noopener">
                обробкою персональних даних
              </a>
              .
            </p>
          </>
        ) : null}
      </form>
    </div>
  );
}
