"use client";

import { useState, useTransition } from "react";
import FormError from "@/components/FormError";
import { setMoney } from "./actions";
import styles from "./MoneyFields.module.css";

type Props = {
  id: string;
  price: number | null;
  partsCost: number | null;
  /** Скільки клієнт вносить наперед, за деталь */
  prepayment: number | null;
  prepaidAt: Date | null;
  paidAt: Date | null;
  /** За скільки вже робили цю ж роботу на цій же моделі */
  hint?: { count: number; last: number; min: number; max: number } | null;
};

const digits = (v: string) => v.replace(/\D/g, "");
const asText = (n: number | null) => n?.toString() ?? "";

export default function MoneyFields({
  id,
  price,
  partsCost,
  prepayment,
  prepaidAt,
  paidAt,
  hint,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Поля керовані: збереження одного з них перемальовує картку, і некерований
  // input підхопив би старе значення сусіда просто під час набору.
  const [priceText, setPriceText] = useState(asText(price));
  const [costText, setCostText] = useState(asText(partsCost));
  const [preText, setPreText] = useState(asText(prepayment));
  const [prepaidOn, setPrepaidOn] = useState(Boolean(prepaidAt));
  const [paidOn, setPaidOn] = useState(Boolean(paidAt));

  // Що сервер показував минулого разу. Картка оновлюється сама, і якщо другий
  // майстер змінив суму, поле має її підхопити — але лише те, яке тут не
  // правлять: текст, що відрізняється від останнього значення з сервера, —
  // це незбережений набір, його не чіпаємо.
  const server = { price: asText(price), cost: asText(partsCost), pre: asText(prepayment), prepaid: Boolean(prepaidAt), paid: Boolean(paidAt) };
  const [seen, setSeen] = useState(server);

  if (Object.entries(server).some(([k, v]) => seen[k as keyof typeof server] !== v)) {
    setSeen(server);
    if (priceText === seen.price) setPriceText(server.price);
    if (costText === seen.cost) setCostText(server.cost);
    if (preText === seen.pre) setPreText(server.pre);
    if (server.prepaid !== seen.prepaid) setPrepaidOn(server.prepaid);
    if (server.paid !== seen.paid) setPaidOn(server.paid);
  }

  // На сервер іде лише те поле, яке майстер змінив: уся форма цілком затирала б
  // правки другого майстра значеннями, з якими ця картка колись відкрилась
  const save = (field: "price" | "partsCost" | "prepayment" | "prepaid" | "paid", value: string) => {
    const data = new FormData();
    data.set("id", id);
    data.set(field, value);
    startTransition(async () => setError((await setMoney(data)) ?? ""));
  };

  const profit = (Number(priceText) || 0) - (Number(costText) || 0);
  const hasMoney = priceText !== "" || costText !== "";
  // Решта — те, що клієнт доплачує при видачі
  const rest = Math.max(0, (Number(priceText) || 0) - (Number(preText) || 0));

  return (
    <form className={styles.form} aria-busy={pending} onSubmit={(e) => e.preventDefault()}>

      <div className={styles.field}>
        <label htmlFor={`price-${id}`} className={styles.label}>
          Ціна клієнту
        </label>
        <input
          id={`price-${id}`}
          name="price"
          type="text"
          inputMode="numeric"
          value={priceText}
          placeholder="₴"
          className={styles.input}
          onChange={(e) => setPriceText(digits(e.target.value))}
          onBlur={() => priceText !== server.price && save("price", priceText)}
        />

        {hint && (
          <button
            type="button"
            className={styles.hint}
            title="Підставити цю ціну"
            onClick={() => {
              setPriceText(String(hint.last));
              save("price", String(hint.last));
            }}
          >
            було {hint.last.toLocaleString("uk-UA")} ₴
            {hint.min !== hint.max && (
              <span className={styles.hintRange}>
                {" "}
                · {hint.min.toLocaleString("uk-UA")}–{hint.max.toLocaleString("uk-UA")}
              </span>
            )}
            <span className={styles.hintCount}> · {hint.count}×</span>
          </button>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={`cost-${id}`} className={styles.label}>
          Деталь
        </label>
        <input
          id={`cost-${id}`}
          name="partsCost"
          type="text"
          inputMode="numeric"
          value={costText}
          placeholder="₴"
          className={styles.input}
          onChange={(e) => setCostText(digits(e.target.value))}
          onBlur={() => costText !== server.cost && save("partsCost", costText)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`pre-${id}`} className={styles.label}>
          Передоплата
        </label>
        <input
          id={`pre-${id}`}
          name="prepayment"
          type="text"
          inputMode="numeric"
          value={preText}
          placeholder="₴"
          className={styles.input}
          onChange={(e) => setPreText(digits(e.target.value))}
          onBlur={() => preText !== server.pre && save("prepayment", preText)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>При видачі</span>
        <output className={styles.rest}>{preText ? `${rest.toLocaleString("uk-UA")} ₴` : "—"}</output>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Прибуток</span>
        <output className={profit < 0 ? styles.profitBad : styles.profit}>
          {hasMoney ? `${profit.toLocaleString("uk-UA")} ₴` : "—"}
        </output>
      </div>

      <div className={styles.marks}>
        <label className={styles.paid}>
          <input
            type="checkbox"
            name="prepaid"
            checked={prepaidOn}
            onChange={(e) => {
              setPrepaidOn(e.target.checked);
              save("prepaid", e.target.checked ? "on" : "off");
            }}
          />
          Передоплата внесена
        </label>

        <label className={styles.paid}>
          <input
            type="checkbox"
            name="paid"
            checked={paidOn}
            onChange={(e) => {
              setPaidOn(e.target.checked);
              save("paid", e.target.checked ? "on" : "off");
            }}
          />
          Оплачено повністю
        </label>
      </div>

      <FormError>{error}</FormError>
    </form>
  );
}
