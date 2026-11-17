"use client";

import { useActionState, useState } from "react";
import FormError from "@/components/FormError";
import PhoneInput from "@/components/PhoneInput";
import { LIMITS, onlyLetters } from "@/lib/validate";
import { createLead } from "../actions";
import styles from "./page.module.css";

/** Три поля й галочка — заводиться за пів хвилини, поки клієнт на лінії */
export default function NewLeadForm({ model }: { model?: string }) {
  const [error, action, pending] = useActionState(createLead, null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  return (
    <form action={action} className={styles.form}>
      <div className={styles.row}>
        <label htmlFor="nl-name">Імʼя клієнта</label>
        <input
          id="nl-name"
          name="name"
          className="field"
          autoComplete="off"
          required
          autoFocus
          maxLength={LIMITS.name.max}
          value={name}
          onChange={(e) => setName(onlyLetters(e.target.value))}
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="nl-phone">Телефон</label>
        <PhoneInput id="nl-phone" name="phone" value={phone} onChange={setPhone} required />
      </div>

      <div className={styles.row}>
        <label htmlFor="nl-model">Пристрій</label>
        <input id="nl-model" name="model" className="field" placeholder="Напр. iPhone 13" maxLength={LIMITS.short} defaultValue={model} />
      </div>

      <div className={styles.row}>
        <label htmlFor="nl-problem">Що трапилось</label>
        <textarea id="nl-problem" name="problem" className={`field ${styles.textarea}`} rows={3} maxLength={LIMITS.problem} />
      </div>

      <label className={styles.check}>
        <input type="checkbox" name="handedOver" />
        Клієнт уже залишив пристрій — одразу «У роботі»
      </label>

      <FormError>{error}</FormError>

      <button type="submit" className="btn btn-accent btn-lg" disabled={pending}>
        {pending ? "Зберігаємо…" : "Створити заявку"}
      </button>
    </form>
  );
}
