"use client";

import { useActionState, useRef, useState } from "react";
import type { LeadItem } from "@/db/schema";
import { addItem, removeItem } from "./actions";
import styles from "./order.module.css";

export type StockPart = { id: string; name: string; model: string | null; qty: number; unitCost: number | null };

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;

/**
 * Роботи й деталі заявки. Ціна для клієнта = сума рядків; собівартість
 * видно лише тут, клієнт її не бачить. Деталь можна взяти зі складу —
 * тоді її спишуть, коли клієнт погодить ціну.
 */
export default function Items({
  id,
  items,
  stock,
  locked,
}: {
  id: string;
  items: LeadItem[];
  stock: StockPart[];
  /** Заявку оплачено — суму вже не міняємо */
  locked: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"work" | "part">("work");
  const [error, action, pending] = useActionState(async (_: string | null, data: FormData) => {
    const res = await addItem(data);
    if (res === null) form.current?.reset();
    return res;
  }, null);

  const total = items.reduce((s, i) => s + i.price, 0);
  const cost = items.reduce((s, i) => s + (i.cost ?? 0), 0);

  return (
    <div className={styles.items}>
      {items.length === 0 && <p className={styles.labelHint}>Ще нічого не додано.</p>}
      {items.map((item) => (
        <div key={item.id} className={styles.item}>
          <span className={styles.itemKind}>{item.kind === "work" ? "Робота" : "Деталь"}</span>
          <span className={styles.itemTitle}>
            {item.title}
            {item.partId && (
              <span className={styles.labelHint}> · {item.writtenOffAt ? "списано зі складу" : "зі складу"}</span>
            )}
          </span>
          <b className={styles.itemPrice}>{item.price ? uah(item.price) : "входить"}</b>
          {!locked && (
            <form action={removeItem}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="itemId" value={item.id} />
              <button type="submit" className={styles.iconBtn} aria-label={`Прибрати: ${item.title}`}>
                ×
              </button>
            </form>
          )}
        </div>
      ))}

      <p className={styles.total}>
        <span>Разом для клієнта</span>
        <span className={styles.totalSum}>{uah(total)}</span>
      </p>
      {cost > 0 && (
        <p className={styles.labelHint}>
          Для себе: деталі {uah(cost)} · заробіток {uah(total - cost)}
        </p>
      )}

      {locked ? (
        <p className={styles.labelHint}>Заявку оплачено — суму вже не змінити.</p>
      ) : (
        <form ref={form} action={action} className={styles.addItem}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="kind" value={kind} />
          <div className={styles.chips} role="radiogroup" aria-label="Що додаємо">
            {(["work", "part"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                className={kind === k ? styles.chipOn : styles.chip}
                onClick={() => setKind(k)}
              >
                {k === "work" ? "Робота" : "Деталь"}
              </button>
            ))}
          </div>
          {kind === "part" && stock.length > 0 && (
            <select name="partId" className={styles.input} aria-label="Деталь зі складу" defaultValue="">
              <option value="">Купуємо під замовлення (не зі складу)</option>
              {stock.map((p) => (
                <option key={p.id} value={p.id} disabled={p.qty <= 0}>
                  {p.name}
                  {p.model ? ` · ${p.model}` : ""} — {p.qty > 0 ? `є ${p.qty}` : "немає"}
                </option>
              ))}
            </select>
          )}
          <input
            name="title"
            className={styles.input}
            placeholder={kind === "work" ? "Заміна роз'єму заряджання" : "Роз'єм iPhone 13 Pro"}
            aria-label={kind === "work" ? "Робота" : "Деталь"}
          />
          <div className={styles.row2}>
            <input name="price" className={styles.input} inputMode="numeric" placeholder="Ціна клієнту, ₴" aria-label="Ціна клієнту" />
            <input name="cost" className={styles.input} inputMode="numeric" placeholder="Собівартість, ₴" aria-label="Собівартість" />
          </div>
          <button type="submit" className={styles.softBtn} disabled={pending}>
            + Додати
          </button>
          {error && (
            <p role="alert" className={styles.inlineError}>
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
