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
const POLL_MS = 2_000;

/** Як часто, поки людина друкує, нагадувати серверу «я ще пишу» */
const TYPING_PING_MS = 3_000;

/** Базові смайлики — без бібліотеки: вистачає для «дякую» й «ок» */
const EMOJI = [
  "🙂", "😊", "😂", "😍", "😉", "😎", "🤔", "😅",
  "😢", "😮", "😡", "🙏", "👍", "👎", "👌", "👋",
  "💪", "👏", "🔥", "❤️", "✅", "❌", "📱", "🔧",
];

/** Своє повідомлення, поки сервер його не підтвердив */
type Pending = { id: string; text: string; preview: string | null; failed: boolean; retry: FormData };

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
  const [typing, setTyping] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastPing = useRef(0);

  const load = useCallback(async () => {
    // Згорнута вкладка нічого не показує — не смикаємо сервер тричі на секунду
    if (document.hidden) return;

    try {
      const res = await fetch(`/api/chat/${leadId}?side=${side}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { messages: ChatMessage[]; typing?: boolean };
      setMessages(data.messages);
      setTyping(Boolean(data.typing));
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

  // Нове повідомлення й «друкує…» мають бути видно без прокрутки вручну
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages, pending, typing]);

  /** «Я друкую» — не частіше ніж раз на кілька секунд; збій тут нічого не ламає */
  const pingTyping = () => {
    const now = Date.now();
    if (now - lastPing.current < TYPING_PING_MS) return;
    lastPing.current = now;
    fetch(`/api/chat/${leadId}/typing?side=${side}`, { method: "POST" }).catch(() => {});
  };

  /** Смайлик — туди, де стоїть курсор, і курсор одразу після нього */
  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

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

  /** Надіслати й одразу показати в стрічці з 🕒; збій — «Не надіслано · Повторити» */
  const deliver = async (item: Pending) => {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/chat/${leadId}?side=${side}`, { method: "POST", body: item.retry });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не вдалося надіслати.");
        throw new Error(String(res.status));
      }
      await load();
      setPending((list) => list.filter((p) => p.id !== item.id));
      if (item.preview) URL.revokeObjectURL(item.preview);
    } catch {
      setPending((list) => list.map((p) => (p.id === item.id ? { ...p, failed: true } : p)));
    } finally {
      setSending(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if ((!clean && !photo) || sending) return;

    const form = new FormData();
    form.set("text", clean);
    if (photo) {
      form.set("image", photo.file);
      form.set("width", String(photo.width));
      form.set("height", String(photo.height));
    }

    const item: Pending = { id: crypto.randomUUID(), text: clean, preview: photo?.preview ?? null, failed: false, retry: form };
    setPending((list) => [...list, item]);
    setText("");
    // Прев'ю фото ще потрібне в стрічці, тож не відкликаємо його, а лише прибираємо з чернетки
    setPhoto(null);
    setEmojiOpen(false);
    lastPing.current = 0;
    await deliver(item);
  };

  const retry = (item: Pending) => {
    setPending((list) => list.map((p) => (p.id === item.id ? { ...p, failed: false } : p)));
    deliver({ ...item, failed: false });
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
        ) : messages.length === 0 && pending.length === 0 ? (
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
                  <span className={styles.meta}>
                    <time className={styles.time} dateTime={m.at}>
                      {stamp.format(new Date(m.at))}
                    </time>
                    {m.author === side && <Status state={m.readAt ? "read" : "sent"} />}
                  </span>
                </div>
              </li>
            ))}

            {pending.map((p) => (
              <li key={p.id} className={styles.mine}>
                <div className={styles.bubble}>
                  <span className={styles.author}>Ви</span>
                  {p.preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.preview} alt="Фото надсилається" className={styles.pendingImg} />
                  )}
                  {p.text && <p className={styles.text}>{p.text}</p>}
                  <span className={styles.meta}>
                    {p.failed ? (
                      <button type="button" className={styles.retry} onClick={() => retry(p)} disabled={sending}>
                        Не надіслано · Повторити
                      </button>
                    ) : (
                      <Status state="sending" />
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}

        {typing && (
          <div className={styles.typing} role="status">
            <span className={styles.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {side === "client" ? "Майстер друкує…" : "Клієнт друкує…"}
          </div>
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

        <div className={styles.emojiWrap}>
          <button
            type="button"
            className={styles.attach}
            onClick={() => setEmojiOpen((v) => !v)}
            aria-label="Смайлики"
            aria-expanded={emojiOpen}
            title="Смайлики"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
              <path d="M9 9.5h.01M15 9.5h.01" />
            </svg>
          </button>
          {emojiOpen && (
            <div className={styles.emojiPanel} role="dialog" aria-label="Смайлики">
              {EMOJI.map((e) => (
                <button key={e} type="button" className={styles.emoji} onClick={() => insertEmoji(e)} aria-label={e}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <label htmlFor={`chat-${leadId}`} className="visually-hidden">
          Повідомлення
        </label>
        <textarea
          ref={inputRef}
          id={`chat-${leadId}`}
          className={`field ${styles.input}`}
          rows={2}
          placeholder={side === "client" ? "Напишіть питання майстрові…" : "Відповідь клієнту…"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
            if (e.target.value.trim()) pingTyping();
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

/** 🕒 надсилається → ✓ надіслано (сіра плашка) → ✓✓ прочитано (салатова) */
function Status({ state }: { state: "sending" | "sent" | "read" }) {
  const label = state === "sending" ? "Надсилається" : state === "sent" ? "Надіслано" : "Прочитано";
  return (
    <span className={state === "read" ? styles.statusRead : styles.status} title={label} aria-label={label}>
      {state === "sending" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      ) : (
        <svg width={state === "read" ? 20 : 14} height="14" viewBox={state === "read" ? "0 0 30 24" : "0 0 24 24"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12.5l5 5L20 6.5" />
          {state === "read" && <path d="M14 15.5l2 2L27 6.5" />}
        </svg>
      )}
    </span>
  );
}
