"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shrinkImage, type Shrunk } from "@/lib/shrinkImage";
import type { ChatMessage } from "@/app/api/chat/[lead]/route";
import FormError from "./FormError";
import styles from "./Chat.module.css";

const stamp = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

/** Поки чат відкритий, перепитуємо сервер. Вебсокет тут — зайва інфраструктура. */
const POLL_MS = 3_000;

type Props = {
  leadId: string;
  /** Хто дивиться — від цього залежить бік бульбашок і підписи */
  side: "client" | "master";
  /** Скільки непрочитаних було на момент рендера сторінки */
  unread?: number;
};

export default function Chat({ leadId, side, unread = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  // Збій опитування — окремо від помилки надсилання: наступне вдале читання
  // прибирає лише його, а «не вдалося надіслати» лишається, доки людина не відреагує
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [photo, setPhoto] = useState<Shrunk | null>(null);
  const [preparing, setPreparing] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    // Згорнута вкладка нічого не показує — не смикаємо сервер тричі на секунду
    if (document.hidden) return;

    try {
      const res = await fetch(`/api/chat/${leadId}?side=${side}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
      setLoadError("");
    } catch {
      setLoadError("Не вдалося завантажити листування. Спробуйте пізніше.");
    }
  }, [leadId, side]);

  // Перше читання — на кліку «відкрити», далі лише опитування за таймером.
  // Виклик load() у тілі ефекту був би синхронним setState на кожен рендер.
  useEffect(() => {
    if (!open) return;

    const id = setInterval(load, POLL_MS);

    // Повернулись на вкладку — читаємо одразу, не чекаючи таймера
    const onVisible = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open, load]);

  const openChat = () => {
    setOpen(true);
    load();
  };

  // Нове повідомлення має бути видно без прокрутки вручну
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;

    setPreparing(true);
    setError("");
    try {
      setPhoto(await shrinkImage(file));
    } catch {
      setError("Не вдалося підготувати фото. Спробуйте інше.");
    } finally {
      setPreparing(false);
      // Щоб те саме фото можна було обрати ще раз після скасування
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dropPhoto = () => {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if ((!clean && !photo) || sending) return;

    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("text", clean);
      if (photo) {
        form.set("image", photo.file);
        form.set("width", String(photo.width));
        form.set("height", String(photo.height));
      }

      const res = await fetch(`/api/chat/${leadId}?side=${side}`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не вдалося надіслати.");
        return;
      }

      setText("");
      dropPhoto();
      await load();
    } catch {
      setError("Не вдалося надіслати. Перевірте зв'язок.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={`btn ${side === "client" ? `btn-accent ${styles.openerMain}` : "btn-ghost"} ${styles.opener}`}
        onClick={openChat}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
        {side === "client" ? "Написати майстру" : "Листування"}
        {unread > 0 && <span className={styles.badge}>{unread}</span>}
      </button>
    );
  }

  return (
    <section className={styles.panel} aria-label="Листування з майстром">
      <header className={styles.head}>
        <span className={styles.title}>
          {side === "client" ? "Чат із майстром" : "Чат із клієнтом"}
        </span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setOpen(false)}
          aria-label="Згорнути чат"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className={styles.list} ref={listRef}>
        {messages === null ? (
          <p className={styles.hint}>Завантажуємо…</p>
        ) : messages.length === 0 ? (
          <p className={styles.hint}>
            {side === "client"
              ? "Питайте що завгодно про свій ремонт — майстер відповість тут."
              : "Клієнт ще нічого не писав. Можете написати першим."}
          </p>
        ) : (
          <ol className={styles.messages}>
            {messages.map((m) => (
              <li key={m.id} className={m.author === side ? styles.mine : styles.theirs}>
                <div className={styles.bubble}>
                  <span className={styles.author}>
                    {m.author === side ? "Ви" : side === "client" ? "Майстер" : "Клієнт"}
                  </span>

                  {m.image && (
                    <a
                      href={m.image.url}
                      target="_blank"
                      rel="noopener"
                      className={styles.photo}
                      style={
                        m.image.width && m.image.height
                          ? { aspectRatio: `${m.image.width} / ${m.image.height}` }
                          : undefined
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.image.url} alt="Фото в листуванні" loading="lazy" />
                    </a>
                  )}

                  {m.text && <p className={styles.text}>{m.text}</p>}
                  <time className={styles.time} dateTime={m.at}>
                    {stamp.format(new Date(m.at))}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {photo && (
        <div className={styles.draft}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt="Обране фото" className={styles.draftImg} />
          <div className={styles.draftInfo}>
            <span>Фото готове до надсилання</span>
            <span className={styles.draftSize}>
              {photo.width}&times;{photo.height} &middot; {Math.round(photo.file.size / 1024)} КБ
            </span>
          </div>
          <button
            type="button"
            className={styles.draftDrop}
            onClick={dropPhoto}
            aria-label="Прибрати фото"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}

      <form className={styles.form} onSubmit={send}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(e) => pickPhoto(e.target.files?.[0])}
        />

        <button
          type="button"
          className={styles.attach}
          onClick={() => fileRef.current?.click()}
          disabled={preparing}
          aria-label="Прикріпити фото"
          title="Прикріпити фото"
        >
          {preparing ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 11.5l-7.8 7.8a4.5 4.5 0 0 1-6.4-6.4l8-8a3 3 0 0 1 4.3 4.3l-8 8a1.5 1.5 0 0 1-2.2-2.2l7.3-7.3" />
            </svg>
          )}
        </button>

        <label htmlFor={`chat-${leadId}`} className="visually-hidden">
          Повідомлення
        </label>
        <textarea
          id={`chat-${leadId}`}
          className={`field ${styles.input}`}
          rows={2}
          placeholder={side === "client" ? "Напишіть питання майстрові…" : "Відповідь клієнту…"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            // Enter надсилає, Shift+Enter переносить рядок
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
        />

        <button
          type="submit"
          className={`btn btn-accent ${styles.send}`}
          disabled={sending || (!text.trim() && !photo)}
        >
          {sending ? "…" : "Надіслати"}
        </button>
      </form>

      <FormError>{error || loadError}</FormError>
    </section>
  );
}
