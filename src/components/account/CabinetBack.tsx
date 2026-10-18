import Link from "next/link";
import styles from "../BackButton.module.css";

/**
 * Кнопка «назад» у кабінеті — завжди в конкретне місце, а не за історією:
 * зі сторінок кабінету — у кабінет, з кабінету — на головну.
 */
export default function CabinetBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={styles.back}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
