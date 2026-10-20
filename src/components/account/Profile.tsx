"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { saveBirthday, saveProfilePhone } from "@/app/actions/profile";
import { BIRTHDAY_WINDOW_DAYS, DISCOUNT_PERCENT, inBirthdayWindow } from "@/data/discounts";
import { shrinkImage } from "@/lib/shrinkImage";
import FormError from "../FormError";
import PasswordInput from "../PasswordInput";
import PhoneInput from "../PhoneInput";
import { phoneProblem } from "@/lib/validate";
import styles from "./Profile.module.css";

const longDate = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Профіль клієнта: фото, імʼя, телефон, день народження, пошта й пароль.
 * Фото, імʼя, пошту й пароль зберігає сам Clerk; телефон і дату — сервер,
 * бо від дати залежить знижка.
 */
export default function Profile({ birthday, phone }: { birthday: string | null; phone: string | null }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) {
    return <div className={styles.skeleton} aria-busy="true" />;
  }

  const filled = [Boolean(user.hasImage), Boolean(user.firstName), Boolean(phone), Boolean(birthday)];
  const percent = Math.round((filled.filter(Boolean).length / filled.length) * 100);

  return (
    <div className={styles.wrap}>
      <section className={styles.hero} aria-label="Ваш профіль">
        <Avatar />
        <div className={styles.heroText}>
          <p className={styles.heroName}>{user.firstName || "Як вас звати?"}</p>
          <p className={styles.heroMail}>{user.primaryEmailAddress?.emailAddress}</p>
          <div className={styles.meter} aria-label={`Профіль заповнено на ${percent}%`}>
            <span className={styles.meterBar} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.meterText}>
            {percent === 100 ? "Профіль заповнено — дякуємо! 🎉" : `Профіль заповнено на ${percent}%`}
          </p>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="pro-dani">
        <h2 id="pro-dani" className={styles.h2}>
          Особисті дані
        </h2>
        <NameField />
        <PhoneField saved={phone} />
        <BirthdayField saved={birthday} />
      </section>

      <section className={styles.card} aria-labelledby="pro-poshta">
        <h2 id="pro-poshta" className={styles.h2}>
          Пошта
        </h2>
        <EmailField />
      </section>

      <section className={styles.card} aria-labelledby="pro-parol">
        <h2 id="pro-parol" className={styles.h2}>
          Пароль
        </h2>
        <PasswordField />
      </section>
    </div>
  );
}

/* ---------- Фото ---------- */
function Avatar() {
  const { user } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      // Стискаємо в браузері: фото з телефона важить мегабайти
      const { file: small } = await shrinkImage(file);
      await user.setProfileImage({ file: small });
    } catch {
      setError("Не вдалося оновити фото. Спробуйте інше.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className={styles.avatarWrap}>
      <button
        type="button"
        className={styles.avatar}
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label={user.hasImage ? "Змінити фото" : "Додати фото"}
      >
        {user.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- фото з Clerk, свій CDN
          <img src={user.imageUrl} alt="" />
        ) : (
          <span className={styles.initial}>{(user.firstName || user.primaryEmailAddress?.emailAddress || "?")[0].toUpperCase()}</span>
        )}
        <span className={styles.avatarBadge} aria-hidden="true">
          {busy ? (
            <span className={styles.spinner} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="visually-hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

/* ---------- Імʼя ---------- */
function NameField() {
  const { user } = useUser();
  const [name, setName] = useState(user?.firstName ?? "");
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState("");

  if (!user) return null;
  const changed = name.trim() !== (user.firstName ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Впишіть імʼя — так майстер звертатиметься до вас.");
      return;
    }
    setState("busy");
    setError("");
    try {
      await user.update({ firstName: name.trim() });
      setState("saved");
    } catch {
      setError("Не вдалося зберегти. Спробуйте ще раз.");
      setState("idle");
    }
  };

  return (
    <form className={styles.row} onSubmit={save}>
      <label htmlFor="pro-name">Імʼя</label>
      <div className={styles.inline}>
        <input
          id="pro-name"
          className="field"
          autoComplete="given-name"
          placeholder="Як до вас звертатись"
          value={name}
          maxLength={50}
          onChange={(e) => {
            setName(e.target.value);
            setState("idle");
            setError("");
          }}
        />
        <SaveButton state={state} disabled={!changed} />
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}

/* ---------- Телефон ---------- */
function PhoneField({ saved }: { saved: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(saved ?? "");
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState("");
  const changed = phone !== (saved ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = phone ? phoneProblem(phone) : null;
    if (problem) {
      setError(problem);
      return;
    }
    setState("busy");
    setError("");
    const res = await saveProfilePhone(phone).catch(() => ({ ok: false as const, error: "Не вдалося зберегти." }));
    if (!res.ok) {
      setError(res.error);
      setState("idle");
      return;
    }
    setState("saved");
    router.refresh();
  };

  return (
    <form className={styles.row} onSubmit={save}>
      <label htmlFor="pro-phone">Телефон</label>
      <div className={styles.inline}>
        <PhoneInput
          id="pro-phone"
          value={phone}
          aria-invalid={error ? true : undefined}
          className={error ? "field field-invalid" : "field"}
          onChange={(v) => {
            setPhone(v);
            setState("idle");
            setError("");
          }}
        />
        <SaveButton state={state} disabled={!changed} />
      </div>
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <p className={styles.note}>Підставимо в кожне замовлення — вводити щоразу не треба.</p>
      )}
    </form>
  );
}

/* ---------- День народження ---------- */
function BirthdayField({ saved }: { saved: string | null }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pct = DISCOUNT_PERCENT.birthday;

  if (saved) {
    const [, m, d] = saved.split("-").map(Number);
    const day = longDate.format(new Date(Date.UTC(2000, m - 1, d)));
    return (
      <div className={styles.row}>
        <span className={styles.label}>День народження</span>
        <div className={inBirthdayWindow(saved) ? styles.bdayOn : styles.bday}>
          <span className={styles.bdayIcon} aria-hidden="true">
            🎂
          </span>
          <span>
            <strong>{day}</strong>
            <span className={styles.note}>
              {inBirthdayWindow(saved)
                ? ` · зараз діє знижка −${pct}% — замовляйте!`
                : ` · −${pct}% за ${BIRTHDAY_WINDOW_DAYS} днів до і ${BIRTHDAY_WINDOW_DAYS} після`}
            </span>
          </span>
        </div>
      </div>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError("Оберіть дату народження.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await saveBirthday(date).catch(() => ({ ok: false as const, error: "Не вдалося зберегти." }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  };

  return (
    <form className={styles.row} onSubmit={save}>
      <label htmlFor="pro-bday">День народження</label>
      <div className={styles.promo}>
        🎁 Вкажіть дату — і тиждень до та після дня народження на ремонт діятиме <strong>знижка −{pct}%</strong>.
      </div>
      <div className={styles.inline}>
        <input
          id="pro-bday"
          type="date"
          className={error ? "field field-invalid" : "field"}
          value={date}
          min="1915-01-01"
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            setDate(e.target.value);
            setError("");
          }}
        />
        <SaveButton state={busy ? "busy" : "idle"} disabled={!date} />
      </div>
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <p className={styles.note}>Перевірте перед збереженням: змінити дату потім можна лише через майстра.</p>
      )}
    </form>
  );
}

/* ---------- Пошта ---------- */
function EmailField() {
  const { user } = useUser();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!user) return null;
  const primary = user.primaryEmailAddress;
  const verified = primary?.verification?.status === "verified";

  const reset = () => {
    setEditing(false);
    setEmail("");
    setCode("");
    setPendingId(null);
    setError("");
  };

  // Крок 1: додаємо нову адресу й надсилаємо на неї код
  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(mail)) {
      setError("Перевірте адресу пошти — здається, у ній помилка.");
      return;
    }
    if (mail === primary?.emailAddress) {
      setError("Це й так ваша пошта.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const added = user.emailAddresses.find((a) => a.emailAddress === mail) ?? (await user.createEmailAddress({ email: mail }));
      await added.prepareVerification({ strategy: "email_code" });
      setPendingId(added.id);
    } catch (err) {
      const taken = (err as { errors?: { code?: string }[] })?.errors?.[0]?.code === "form_identifier_exists";
      setError(taken ? "Ця пошта вже прив'язана до іншого акаунта." : "Не вдалося надіслати код. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  };

  // Крок 2: код підійшов — нова адреса стає головною, стара прибирається
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = user.emailAddresses.find((a) => a.id === pendingId);
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const res = await address.attemptVerification({ code: code.trim() });
      if (res.verification.status !== "verified") throw new Error("not verified");
      const old = user.primaryEmailAddress;
      await user.update({ primaryEmailAddressId: address.id });
      if (old && old.id !== address.id) await old.destroy();
      await user.reload();
      reset();
      setDone(true);
    } catch {
      setError("Код не підійшов. Перевірте останній лист або надішліть код ще раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.row}>
      <div className={styles.current}>
        <span className={styles.mail}>{primary?.emailAddress}</span>
        {verified && (
          <span className={styles.verified}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            підтверджено
          </span>
        )}
      </div>
      {done && <p className={styles.success}>Пошту змінено й підтверджено.</p>}

      {!editing ? (
        <button type="button" className={styles.link} onClick={() => (setEditing(true), setDone(false))}>
          Змінити пошту
        </button>
      ) : !pendingId ? (
        <form className={styles.inline} onSubmit={sendCode}>
          <label htmlFor="pro-email" className="visually-hidden">
            Нова пошта
          </label>
          <input
            id="pro-email"
            type="email"
            className="field"
            autoComplete="email"
            placeholder="Нова пошта"
            value={email}
            autoFocus
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy ? "Надсилаємо…" : "Надіслати код"}
          </button>
          <button type="button" className={styles.link} onClick={reset}>
            Скасувати
          </button>
        </form>
      ) : (
        <form className={styles.inline} onSubmit={confirm}>
          <label htmlFor="pro-code" className="visually-hidden">
            Код із листа
          </label>
          <input
            id="pro-code"
            className={`field ${styles.code}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Код із листа"
            value={code}
            autoFocus
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
          />
          <button type="submit" className="btn btn-accent" disabled={busy || code.length < 6}>
            {busy ? "Перевіряємо…" : "Підтвердити"}
          </button>
          <button type="button" className={styles.link} onClick={reset}>
            Скасувати
          </button>
        </form>
      )}
      {pendingId && !error && <p className={styles.note}>Надіслали код на {email.trim()}. Лист іде до хвилини.</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

/* ---------- Пароль ---------- */
function PasswordField() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!user) return null;
  const has = user.passwordEnabled;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      setError("Новий пароль — щонайменше 8 символів.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await user.updatePassword(has ? { currentPassword: current, newPassword: next } : { newPassword: next });
      setOpen(false);
      setCurrent("");
      setNext("");
      setDone(true);
    } catch (err) {
      const code = (err as { errors?: { code?: string }[] })?.errors?.[0]?.code;
      setError(
        code === "form_password_incorrect"
          ? "Поточний пароль не підходить."
          : code === "form_password_pwned"
            ? "Цей пароль засвітився у витоках даних. Придумайте інший."
            : "Не вдалося змінити пароль. Спробуйте ще раз.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.row}>
      <p className={styles.note}>
        {has ? "Пароль задано — входьте поштою й паролем." : "Пароля ще немає — входите кодом на пошту."}
      </p>
      {done && <p className={styles.success}>Пароль збережено.</p>}
      {!open ? (
        <button type="button" className={styles.link} onClick={() => (setOpen(true), setDone(false))}>
          {has ? "Змінити пароль" : "Задати пароль"}
        </button>
      ) : (
        <form className={styles.stack} onSubmit={save}>
          {has && (
            <PasswordInput
              autoComplete="current-password"
              placeholder="Поточний пароль"
              aria-label="Поточний пароль"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          )}
          <PasswordInput
            autoComplete="new-password"
            placeholder="Новий пароль — щонайменше 8 символів"
            aria-label="Новий пароль"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setError("");
            }}
          />
          <FormError>{error}</FormError>
          <div className={styles.inline}>
            <button type="submit" className="btn btn-accent" disabled={busy}>
              {busy ? "Зберігаємо…" : "Зберегти пароль"}
            </button>
            <button type="button" className={styles.link} onClick={() => setOpen(false)}>
              Скасувати
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SaveButton({ state, disabled }: { state: "idle" | "busy" | "saved"; disabled: boolean }) {
  return (
    <button type="submit" className={`btn ${state === "saved" ? "btn-ghost" : "btn-accent"} ${styles.save}`} disabled={disabled || state === "busy"}>
      {state === "busy" ? "…" : state === "saved" ? "✓ Збережено" : "Зберегти"}
    </button>
  );
}
