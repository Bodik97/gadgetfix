"use client";

import { useEffect, useState } from "react";
import styles from "./NotifyToggle.module.css";

type State = "loading" | "hidden" | "off" | "denied" | "on";

/** Ключ VAPID у base64url → байти, як їх чекає pushManager.subscribe */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * «Сповіщати мене»: push, коли майстер написав чи змінився статус. Браузер
 * без push (iPhone у звичайному Safari) — плашки не показуємо: таким клієнтам
 * прийде лист на пошту.
 */
export default function NotifyToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported || !vapid) return setState("hidden");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const existing = await reg?.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })().catch(() => setState("hidden"));
  }, [vapid]);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid) }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub: sub.toJSON(), userAgent: navigator.userAgent }),
      });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "hidden") return null;

  if (state === "on") {
    return (
      <p className={styles.on}>
        <Bell /> Сповіщення увімкнено — дізнаєтесь про відповідь майстра одразу.
      </p>
    );
  }

  return (
    <section className={styles.card} aria-label="Сповіщення">
      <span className={styles.icon} aria-hidden="true">
        <Bell />
      </span>
      <div className={styles.text}>
        <strong>Дізнавайтесь про відповідь майстра одразу</strong>
        <span>
          {state === "denied"
            ? "Сповіщення заборонені в браузері — дозвольте їх у налаштуваннях сайту. А поки листи приходитимуть на пошту."
            : "Push на телефон чи комп'ютер: майстер написав, ремонт готовий. Без пошти й дзвінків."}
        </span>
      </div>
      {state === "off" && (
        <button type="button" className="btn btn-ghost" onClick={enable} disabled={busy}>
          {busy ? "Вмикаємо…" : "Увімкнути"}
        </button>
      )}
    </section>
  );
}

function Bell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}
