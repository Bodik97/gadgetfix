"use client";

import { useActionState } from "react";
import type { PartnerPrice } from "@/db/schema";
import { addPrice, togglePrice, updatePrice } from "./actions";
import styles from "./onlain.module.css";

/**
 * Прайс магазину «Онлайн». Ціна вже включає нашу деталь; собівартість —
 * скільки деталь коштує нам (магазин її не бачить, нам — для заробітку).
 */
export default function PriceList({ prices }: { prices: PartnerPrice[] }) {
  return (
    <div className={styles.priceBox}>
      <p className={styles.lead}>
        Ціни магазину — разом із нашою деталлю. Їх бачить лише цей розділ і швидкий прийом; у звичайних заявках діє наш прайс.
        Нова ціна діє на нові заявки — вже прийняті лишаються з тією, за якою їх приймали.
      </p>

      <div className={styles.priceHead} aria-hidden="true">
        <span>Модель</span>
        <span>Робота</span>
        <span>Ціна магазину</span>
        <span>Нам деталь</span>
        <span />
        <span />
      </div>
      {prices.map((p) => (
        <PriceRow key={p.id} price={p} />
      ))}
      <AddRow />
    </div>
  );
}

function PriceRow({ price: p }: { price: PartnerPrice }) {
  const [error, action, pending] = useActionState(updatePrice, null);
  return (
    <div className={p.active ? styles.priceRow : styles.priceRowOff}>
      <form action={action} className={styles.priceForm}>
        <input type="hidden" name="id" value={p.id} />
        <input name="model" defaultValue={p.model} className={styles.input} aria-label="Модель" disabled={!p.active} />
        <input name="work" defaultValue={p.work} className={styles.input} aria-label="Робота" disabled={!p.active} />
        <input name="price" defaultValue={p.price} inputMode="numeric" className={styles.input} aria-label="Ціна магазину, ₴" disabled={!p.active} />
        <input name="cost" defaultValue={p.cost ?? ""} inputMode="numeric" placeholder="—" className={styles.input} aria-label="Нам деталь коштує, ₴" disabled={!p.active} />
        {p.active && (
          <button type="submit" className={styles.soft} disabled={pending}>
            Зберегти
          </button>
        )}
      </form>
      <form action={togglePrice}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="active" value={p.active ? "0" : "1"} />
        <button type="submit" className={styles.ghost}>
          {p.active ? "Прибрати" : "Повернути"}
        </button>
      </form>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function AddRow() {
  const [error, action, pending] = useActionState(async (prev: string | null, f: FormData) => {
    const res = await addPrice(prev, f);
    if (res === null) (document.getElementById("price-add") as HTMLFormElement | null)?.reset();
    return res;
  }, null);
  return (
    <div className={styles.priceAdd}>
      <form id="price-add" action={action} className={styles.priceForm}>
        <input name="model" placeholder="Модель" className={styles.input} aria-label="Модель" />
        <input name="work" placeholder="Робота" className={styles.input} aria-label="Робота" />
        <input name="price" placeholder="Ціна, ₴" inputMode="numeric" className={styles.input} aria-label="Ціна магазину, ₴" />
        <input name="cost" placeholder="Деталь, ₴" inputMode="numeric" className={styles.input} aria-label="Нам деталь коштує, ₴" />
        <button type="submit" className={styles.main} disabled={pending}>
          + Додати
        </button>
      </form>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
