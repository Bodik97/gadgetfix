"use client";

import { useRef, useState } from "react";
import { shrinkImage, type Shrunk } from "@/lib/shrinkImage";
import styles from "./BeforeAfterPicker.module.css";

/**
 * Довша сторона для пари фото. Обидва знімки їдуть одним запитом, а сервер
 * приймає до 1 МБ — з 1280 пікселів пара важить 300–600 КБ.
 */
const PAIR_SIDE = 1280;

export type PhotoPair = { before: Shrunk | null; after: Shrunk | null };

/** Пара фото у FormData — під іменами, які чекає сервер */
export function appendPair(form: FormData, pair: PhotoPair) {
  if (pair.before) form.set("before", pair.before.file);
  if (pair.after) form.set("after", pair.after.file);
}

/** Дві плитки: «До ремонту» і «Після» — тап відкриває камеру чи галерею */
export default function BeforeAfterPicker({
  value,
  onChange,
}: {
  value: PhotoPair;
  onChange: (next: PhotoPair) => void;
}) {
  const [error, setError] = useState("");

  return (
    <div className={styles.wrap}>
      <div className={styles.pair}>
        <Tile label="До ремонту" photo={value.before} onError={setError}
          onPick={(photo) => onChange({ ...value, before: photo })} />
        <Tile label="Після" photo={value.after} onError={setError}
          onPick={(photo) => onChange({ ...value, after: photo })} />
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function Tile({
  label,
  photo,
  onPick,
  onError,
}: {
  label: string;
  photo: Shrunk | null;
  onPick: (photo: Shrunk | null) => void;
  onError: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onPick(await shrinkImage(file, PAIR_SIDE));
      onError("");
    } catch {
      onError("Не вдалося підготувати фото. Спробуйте інше.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className={styles.tile}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt={label} className={styles.img} />
          <span className={styles.badge}>{label}</span>
          <button type="button" className={styles.remove} onClick={() => onPick(null)} aria-label={`Прибрати фото «${label}»`}>
            ×
          </button>
        </>
      ) : (
        <button type="button" className={styles.add} onClick={() => fileRef.current?.click()}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span>Фото «{label.toLowerCase()}»</span>
        </button>
      )}
    </div>
  );
}
