"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PHOTO_SLOTS } from "@/data/orderOptions";
import { saveSignature, uploadPhoto } from "./actions";
import styles from "./order.module.css";

/**
 * Фото «спереду / ззаду / рамка» камерою телефона і підпис клієнта пальцем.
 * Файли — у приватне сховище; показуємо їх маршрутом /foto/…, лише майстру.
 */

export type PhotoInfo = { id: string; slot: string };

export function PhotoSlots({ id, photos }: { id: string; photos: PhotoInfo[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(slot: string, file: File | undefined) {
    if (!file) return;
    setBusy(slot);
    setError(null);
    const f = new FormData();
    f.set("id", id);
    f.set("slot", slot);
    f.set("file", file);
    const res = await uploadPhoto(f);
    setBusy(null);
    if (res) setError(res);
  }

  return (
    <div>
      <div className={styles.photos}>
        {PHOTO_SLOTS.map(({ slot, label }) => {
          const shot = photos.findLast((p) => p.slot === slot);
          return (
            <label key={slot} className={shot ? styles.photoDone : styles.photo}>
              {shot ? (
                // eslint-disable-next-line @next/next/no-img-element -- приватне фото з нашого маршруту, оптимізатор його не дістане
                <img src={`/admin/zayavky/${id}/foto/${shot.id}`} alt={label} className={styles.photoImg} />
              ) : (
                <span className={styles.photoPlus} aria-hidden="true">
                  +
                </span>
              )}
              <span className={styles.photoLabel}>{busy === slot ? "Завантажую…" : shot ? `${label} ✓` : label}</span>
              {/* capture — на телефоні одразу камера */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="visually-hidden"
                onChange={(e) => upload(slot, e.target.files?.[0])}
              />
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className={styles.inlineError}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Підпис пальцем (або мишкою) на полотні. «Зберегти» відправляє PNG. */
export function SignaturePad({
  id,
  kind,
  signed,
}: {
  id: string;
  kind: "intake" | "handover";
  /** Підпис уже є — показуємо його й кнопку «Підписати заново» */
  signed: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [editing, setEditing] = useState(!signed);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Після збереження картинка та сама адреса — додаємо мітку, щоб браузер не взяв стару
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !editing) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111311";
  }, [editing]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  function clear() {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  }

  function save() {
    const c = canvas.current;
    if (!c || empty) return;
    c.toBlob((blob) => {
      if (!blob) return setError("Підпис не зберігся — спробуйте ще раз.");
      const f = new FormData();
      f.set("id", id);
      f.set("kind", kind);
      f.set("file", new File([blob], "sign.png", { type: "image/png" }));
      start(async () => {
        const res = await saveSignature(f);
        if (res) setError(res);
        else {
          setEditing(false);
          setVersion((v) => v + 1);
        }
      });
    }, "image/png");
  }

  if (!editing) {
    return (
      <div className={styles.signDone}>
        {/* eslint-disable-next-line @next/next/no-img-element -- приватний підпис з нашого маршруту */}
        <img
          src={`/admin/zayavky/${id}/foto/sign-${kind}?v=${version}`}
          alt="Підпис клієнта"
          className={styles.signImg}
        />
        <button type="button" className={styles.ghostBtn} onClick={() => setEditing(true)}>
          Підписати заново
        </button>
      </div>
    );
  }

  return (
    <div className={styles.sign}>
      <canvas
        ref={canvas}
        className={styles.signCanvas}
        aria-label="Поле для підпису пальцем"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = point(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = point(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          setEmpty(false);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      />
      <div className={styles.signBar}>
        <span className={styles.labelHint}>Клієнт підписує пальцем</span>
        <button type="button" className={styles.ghostBtn} onClick={clear} disabled={empty}>
          Стерти
        </button>
        <button type="button" className={styles.softBtn} onClick={save} disabled={empty || pending}>
          {pending ? "Зберігаю…" : "Зберегти підпис"}
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.inlineError}>
          {error}
        </p>
      )}
    </div>
  );
}
