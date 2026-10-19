"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signupDiscountWaiting } from "@/app/actions/account";
import { openSignUp, prepareSignIn, useAuthState } from "./auth/authStore";
import styles from "./RegisterBonus.module.css";

/**
 * Знижка 5% за реєстрацію — на перший ремонт. Гостю пропонуємо зареєструватись,
 * тому, хто увійшов і ще не ремонтувався, — одразу у форму, де знижку вже застосовано.
 * Хто вже ремонтувався, свою знижку використав — блоку не бачить.
 */
export default function RegisterBonus() {
  const { isSignedIn } = useAuthState();
  // Сторінка статична, тож про знижку дізнаємось тут. Поки відповіді немає — блок для гостя.
  const [waiting, setWaiting] = useState<boolean | null>(null);
  const signedIn = Boolean(isSignedIn) && waiting !== null;

  useEffect(() => {
    if (!isSignedIn) return;
    let stale = false;
    signupDiscountWaiting()
      // Не вдалося спитати — не обіцяємо знижку, якої може не бути
      .catch(() => false)
      .then((w) => {
        if (!stale) setWaiting(Boolean(w));
      });
    return () => {
      stale = true;
    };
  }, [isSignedIn]);

  if (signedIn && !waiting) return null;

  return (
    <div className={styles.wrap}>
      <div>
        <h3 className={styles.title}>Мінус 5% на перший ремонт</h3>
        <p className={styles.text}>
          {signedIn
            ? "Кабінет у вас уже є — знижка діє на перший ремонт iPhone, iPad, Apple Watch чи Android-смартфона."
            : "Створіть кабінет на сайті — і знижка діятиме одразу: на ремонт iPhone, iPad, Apple Watch чи Android-смартфона."}
        </p>
      </div>

      <div className={styles.box}>
        <span className={styles.percent}>−5%</span>
        {signedIn ? (
          <>
            <p className={styles.boxTitle}>Ваша знижка чекає</p>
            <p className={styles.boxText}>
              Оберіть, що відремонтувати, — знижку вже буде застосовано, а майстер назве ціну з&nbsp;нею.
            </p>
            <Link href="/moi-remonty?znyzhka=1" className="btn btn-accent btn-lg" data-track="bonus-use">
              Скористатись знижкою 5%
            </Link>
          </>
        ) : (
          <>
            <p className={styles.boxTitle}>За реєстрацію на сайті</p>
            <ul className={styles.list}>
              <li>Знижка 5% на перший ремонт — одразу після реєстрації</li>
              <li>Статус ремонту й посилка — у кабінеті</li>
              <li>Після ремонту — ще 10% за відгук</li>
            </ul>
            <button
              type="button"
              className="btn btn-accent btn-lg"
              onClick={openSignUp}
              onPointerEnter={prepareSignIn}
              onFocus={prepareSignIn}
              data-track="bonus-signup"
            >
              Отримати −5%
            </button>
          </>
        )}
      </div>
    </div>
  );
}
