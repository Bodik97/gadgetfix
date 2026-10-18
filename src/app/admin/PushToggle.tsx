"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush, type PushKeys } from "./actions";
import styles from "./page.module.css";

type State =
  | "loading"
  | "unsupported" // браузер не вміє push
  | "ios-install" // iPhone у звичайному Safari: push лише з іконки на головному екрані
  | "off"
  | "denied" // майстер колись заборонив — увімкнути можна лише в налаштуваннях
  | "on";

/** Ключ VAPID у base64url → байти, як їх чекає pushManager.subscribe */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * «Увімкнути сповіщення на цьому телефоні».
 *
 * Дозвіл телефон питає лише після натискання — тож кожен майстер вмикає
 * сам, один раз на кожному пристрої. Після цього заявки, повідомлення й
 * відгуки приходять push-ом навіть із закритим застосунком.
 */
export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");

      const reg = await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid) }));
      await savePushSubscription(sub.toJSON() as PushKeys, navigator.userAgent);
      setState("on");
      setNote("Готово. Натисніть «Надіслати тест», щоб перевірити.");
    } catch {
      setNote("Не вдалося увімкнути. Перевірте інтернет і спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/admin/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setNote("");
    // Service worker повідомить, коли покаже сповіщення на цьому пристрої
    const arrived = new Promise<boolean>((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type !== "push-shown" || e.data.tag !== "test") return;
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve(true);
      };
      navigator.serviceWorker.addEventListener("message", onMessage);
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve(false);
      }, 10_000);
    });

    try {
      const n = await sendTestPush();
      if (n === 0) {
        setNote("Не дійшло. Вимкніть і увімкніть сповіщення знову.");
        return;
      }
      setNote("Надіслали — чекаємо підтвердження від цього пристрою…");
      setNote(
        (await arrived)
          ? "Дійшло на цей пристрій. Не бачите банера? Увімкніть сповіщення для браузера в налаштуваннях системи (Mac: Системні параметри → Сповіщення → Google Chrome) і вимкніть «Не турбувати»."
          : "Сервер надіслав, але цей пристрій не підтвердив. Вимкніть і увімкніть сповіщення тут знову.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;

  // Ключів немає — сповіщення ще не налаштовані на сервері, кнопка нічого б не дала
  if (!vapid) return null;

  return (
    <div className={state === "on" ? styles.pushOn : styles.pushOff}>
      <div className={styles.pushText}>
        {state === "on" && <strong>Сповіщення увімкнено на цьому пристрої</strong>}
        {state === "off" && (
          <>
            <strong>Сповіщення на телефон вимкнено</strong>
            <span>Нові заявки, повідомлення й відгуки — push-ом, навіть коли застосунок закритий.</span>
          </>
        )}
        {state === "ios-install" && (
          <>
            <strong>Щоб отримувати сповіщення на iPhone</strong>
            <span>Поділитися → «На початковий екран», потім відкрийте адмінку з іконки «GadgetFix Адмін».</span>
          </>
        )}
        {state === "denied" && (
          <>
            <strong>Сповіщення заборонені для цього сайту</strong>
            <span>Увімкніть їх у налаштуваннях телефона для «GadgetFix Адмін» і оновіть сторінку.</span>
          </>
        )}
        {state === "unsupported" && (
          <>
            <strong>Цей браузер не підтримує сповіщення</strong>
            <span>Відкрийте адмінку в Chrome (Android) або з іконки на головному екрані (iPhone).</span>
          </>
        )}
        {note && <span className={styles.pushNote}>{note}</span>}
      </div>

      <div className={styles.pushActions}>
        {state === "off" && (
          <button type="button" className="btn btn-accent" onClick={enable} disabled={busy}>
            Увімкнути сповіщення
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" className="btn btn-ghost" onClick={test} disabled={busy}>
              Надіслати тест
            </button>
            <button type="button" className={styles.pushDisable} onClick={disable} disabled={busy}>
              Вимкнути
            </button>
          </>
        )}
      </div>
    </div>
  );
}
