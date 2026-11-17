"use client";

import { useActionState, useRef, useState } from "react";
import type { PartnerPrice } from "@/db/schema";
import type { BatchResult } from "./actions";
import { createOnlineBatch, createOnlineLead } from "./actions";
import styles from "./board.module.css";

/**
 * Швидкий прийом від магазину «Онлайн» — один рядок над дошкою:
 * № квитанції магазину, робота з його прайсу (ціна підставляється сама), примітка.
 */
export default function OnlineIntake({ prices }: { prices: PartnerPrice[] }) {
  const [batch, setBatch] = useState(false);
  if (prices.length > 0 && batch) return <BatchIntake onSingle={() => setBatch(false)} />;
  return <SingleIntake prices={prices} onBatch={() => setBatch(true)} />;
}

/** Перемикач «Один / Пачкою» у заголовку прийому */
function Mode({ batch, onPick }: { batch: boolean; onPick: () => void }) {
  return (
    <span className={styles.intakeMode} role="group" aria-label="Як приймаємо">
      <button type="button" className={batch ? styles.modeBtn : styles.modeOn} aria-pressed={!batch} onClick={batch ? onPick : undefined}>
        Один
      </button>
      <button type="button" className={batch ? styles.modeOn : styles.modeBtn} aria-pressed={batch} onClick={batch ? undefined : onPick}>
        Пачкою
      </button>
    </span>
  );
}

function SingleIntake({ prices, onBatch }: { prices: PartnerPrice[]; onBatch: () => void }) {
  const form = useRef<HTMLFormElement>(null);
  const [priceId, setPriceId] = useState(prices[0]?.id ?? "");
  const [error, action, pending] = useActionState(async (prev: string | null, data: FormData) => {
    const res = await createOnlineLead(prev, data);
    // Додали — чистимо № і примітку, роботу лишаємо: магазин часто несе однакові
    if (res === null) {
      form.current?.querySelectorAll<HTMLInputElement>("input[type=text]").forEach((i) => (i.value = ""));
      form.current?.querySelector<HTMLInputElement>("#on-ext")?.focus();
    }
    return res;
  }, null);

  if (prices.length === 0) {
    return (
      <p className={styles.intakeEmpty}>
        Прайс магазину порожній — додайте роботи в розділі «Онлайн», і тут зʼявиться швидкий прийом.
      </p>
    );
  }

  const price = prices.find((p) => p.id === priceId)?.price ?? 0;

  return (
    <form ref={form} action={action} className={styles.intake}>
      <p className={styles.intakeTitle}>
        Швидкий прийом <Mode batch={false} onPick={onBatch} />
      </p>
      <div className={styles.intakeField}>
        <label htmlFor="on-ext">№ магазину</label>
        <input id="on-ext" name="externalNo" type="text" placeholder="М-4486" required autoComplete="off" />
      </div>
      <div className={styles.intakeWide}>
        <label htmlFor="on-work">Робота з прайсу магазину</label>
        <select id="on-work" name="priceId" value={priceId} onChange={(e) => setPriceId(e.target.value)}>
          {prices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.model} · {p.work} — {p.price.toLocaleString("uk-UA")} ₴
            </option>
          ))}
        </select>
      </div>
      <div className={styles.intakeWide}>
        <label htmlFor="on-note">Примітка</label>
        <input id="on-note" name="note" type="text" placeholder="необов'язково" autoComplete="off" />
      </div>
      <button type="submit" className={styles.intakeAdd} disabled={pending}>
        Додати · {price.toLocaleString("uk-UA")} ₴
      </button>
      {error && (
        <p role="alert" className={styles.intakeError}>
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Пачкою: вставили список із повідомлення магазину, по телефону в рядку.
 * Невпізнані рядки лишаються в полі — їх видно й можна виправити.
 */
function BatchIntake({ onSingle }: { onSingle: () => void }) {
  const [text, setText] = useState("");
  const [result, action, pending] = useActionState(async (prev: BatchResult | null, data: FormData) => {
    const res = await createOnlineBatch(prev, data);
    setText(res.failed.map((f) => f.line).join("\n"));
    return res;
  }, null);

  return (
    <form action={action} className={styles.intake}>
      <p className={styles.intakeTitle}>
        Швидкий прийом <Mode batch onPick={onSingle} />
      </p>
      <div className={styles.intakeWide}>
        <label htmlFor="on-batch">Список від магазину — по телефону в рядку: № магазину, модель, робота</label>
        <textarea
          id="on-batch"
          name="text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"М-4486 Redmi 13C АКБ\nМ-4487 Samsung A36 дисплей, тріснуте скло"}
          className={styles.batchText}
        />
      </div>
      <button type="submit" className={styles.intakeAdd} disabled={pending || !text.trim()}>
        Додати всі
      </button>
      {result && (
        <p role="status" className={result.failed.length > 0 ? styles.intakeError : styles.intakeOk}>
          {result.created > 0 && `Додано: ${result.created}. `}
          {result.failed.length > 0 &&
            `Не впізнали ${result.failed.length}: ${result.failed.map((f) => `«${f.line}» — ${f.reason}`).join("; ")}. Виправте рядки в полі або додайте по одному.`}
        </p>
      )}
    </form>
  );
}
