import { site } from "@/data/site";
import styles from "./FaqAside.module.css";

/** Підказка під заголовком блоку питань: не знайшли відповідь — подзвоніть. */
export default function FaqAside() {
  return (
    <div className={styles.aside}>
      <p className={styles.text}>
        Не знайшли відповідь? Подзвоніть — пояснимо за пару хвилин, це ні до чого не зобов&apos;язує.
      </p>
      <a href={site.phones[0].href} className="btn btn-ghost">
        {site.phones[0].label}
      </a>
    </div>
  );
}
