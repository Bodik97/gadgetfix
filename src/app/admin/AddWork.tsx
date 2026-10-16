"use client";

import { useRef, useState } from "react";
import BeforeAfterPicker, { appendPair, type PhotoPair } from "@/components/BeforeAfterPicker";
import FormError from "@/components/FormError";
import { addWork } from "./actions";
import styles from "./AddReview.module.css";

/** Нова робота для блоку «Результати робіт» на головній */
export default function AddWork() {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoPair>({ before: null, after: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    appendPair(form, photos);

    setBusy(true);
    setError("");
    try {
      const err = await addWork(form);
      if (err) {
        setError(err);
        return;
      }
      formRef.current?.reset();
      setPhotos({ before: null, after: null });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-accent" onClick={() => setOpen(true)}>
        Додати роботу
      </button>
    );
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit}>
      <div className={styles.head}>
        <h3 className={styles.title}>Нова робота</h3>
        <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>
          Скасувати
        </button>
      </div>

      <BeforeAfterPicker value={photos} onChange={setPhotos} />

      <label className={styles.field}>
        <span className={styles.label}>Пристрій</span>
        <input name="device" className="field" type="text" placeholder="iPhone 13 Pro" maxLength={60} required />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Що зробили</span>
        <textarea
          name="text"
          className={`field ${styles.textarea}`}
          placeholder="Замінили розбитий дисплей на оригінальний, перевірили Face ID і True Tone"
          maxLength={300}
          required
        />
      </label>

      <FormError>{error}</FormError>

      <button type="submit" className="btn btn-accent" disabled={busy}>
        {busy ? "Зберігаємо…" : "Опублікувати"}
      </button>
    </form>
  );
}
