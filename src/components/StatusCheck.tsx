"use client";

import { useState } from "react";
import type { Order } from "@/app/api/orders/[no]/route";
import FormError from "./FormError";
import styles from "./StatusCheck.module.css";

export default function StatusCheck({
  id = "status",
  title = "Телефон уже в нас? Перевірте етап",
  lead = "Номер замовлення з квитанції та останні 4 цифри вашого телефону — і побачите, що робимо саме зараз.",
}: {
  /** Якір блоку: на сторінці «Поштою» на нього веде кнопка «Де моя посилка» */
  id?: string;
  title?: string;
  lead?: string;
}) {
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setError("");
    setOrder(null);
  };

  const check = async () => {
    const n = orderNo.trim();
    const tail = phone.replace(/\D/g, "");
    reset();

    if (!n) {
      setError("Впишіть номер замовлення з квитанції.");
      return;
    }
    if (tail.length !== 4) {
      setError("Впишіть останні 4 цифри телефону, який лишали при зверненні.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(n)}?phone=${encodeURIComponent(tail)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не знайшли таке замовлення.");
        return;
      }
      setOrder(data as Order);
    } catch {
      setError("Не вдалося перевірити. Спробуйте пізніше або зателефонуйте нам.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id={id} className={styles.section}>
      <div className={styles.box}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.lead}>{lead}</p>
        </div>

        <div className={styles.form}>
          <div className={styles.pair}>
            <div className={styles.field}>
              <label htmlFor="n-order" className={styles.label}>
                Номер замовлення
              </label>
              <input
                id="n-order"
                className="field"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="напр. 1042"
                value={orderNo}
                onChange={(e) => {
                  setOrderNo(e.target.value);
                  reset();
                }}
                onKeyDown={(e) => e.key === "Enter" && check()}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="n-tail" className={styles.label}>
                Останні 4 цифри телефону
              </label>
              <input
                id="n-tail"
                className="field"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="напр. 0238"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 4));
                  reset();
                }}
                onKeyDown={(e) => e.key === "Enter" && check()}
              />
            </div>
          </div>

          <button type="button" onClick={check} className="btn btn-ghost" disabled={loading}>
            {loading ? "Перевіряємо…" : "Перевірити"}
          </button>

          <FormError>{error}</FormError>

          {order && (
            <div className="info">
              <strong>
                Замовлення №{order.no} · {order.device}
              </strong>
              <div className={styles.stages}>
                {order.stages.map((s, i) => (
                  <span key={s} className={i <= order.stage ? styles.stageDone : styles.stage}>
                    {s}
                  </span>
                ))}
              </div>
              <div>
                {order.work} · {order.eta}
              </div>

              {order.log.length > 0 && (
                <ul className={styles.log}>
                  {order.log.map((e, i) => (
                    <li key={i}>
                      <span className={styles.logTime}>{e.time}</span>
                      {e.text}
                    </li>
                  ))}
                </ul>
              )}

            </div>
          )}
        </div>
      </div>
    </section>
  );
}
