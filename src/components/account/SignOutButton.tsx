"use client";

import { useClerk } from "@clerk/nextjs";
import styles from "./SignOutButton.module.css";

/** quiet — тихе посилання внизу сторінки, щоб «Вийти» не натискали випадково */
export default function SignOutButton({ quiet }: { quiet?: boolean } = {}) {
  const { signOut } = useClerk();

  return (
    <button type="button" className={quiet ? styles.quiet : styles.button} onClick={() => signOut({ redirectUrl: "/" })}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 17l5-5-5-5" />
        <path d="M20 12H9" />
        <path d="M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
      </svg>
      Вийти
    </button>
  );
}
