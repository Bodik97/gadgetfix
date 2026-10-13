"use client";

import { useRef, useState, useTransition } from "react";
import { addNote } from "./actions";
import type { LeadEvent } from "@/db/schema";
import styles from "./page.module.css";

const time = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

export default function NoteField({ id, events }: { id: string; events: LeadEvent[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.timeline}>
      <button type="button" className={styles.timelineToggle} onClick={() => setOpen((v) => !v)}>
        {open ? "Сховати хроніку" : `Хроніка · ${events.length}`}
      </button>

      {open && (
        <>
          {events.length > 0 && (
            <ol className={styles.events}>
              {events.map((e) => (
                <li key={e.id} className={styles.event}>
                  <span className={styles.eventTime}>{time.format(e.createdAt)}</span>
                  <span className={styles.eventText}>{e.text}</span>
                </li>
              ))}
            </ol>
          )}

          <form
            ref={formRef}
            action={addNote}
            className={styles.noteForm}
            onSubmit={() => startTransition(() => {})}
          >
            <input type="hidden" name="id" value={id} />
            <label className="visually-hidden" htmlFor={`note-${id}`}>
              Додати подію в хроніку
            </label>
            <input
              id={`note-${id}`}
              name="text"
              type="text"
              className={styles.noteInput}
              placeholder="Що зробили — клієнт це побачить"
              maxLength={300}
              disabled={pending}
            />
            <button type="submit" className={styles.noteSubmit} disabled={pending}>
              {pending ? "…" : "Додати"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
