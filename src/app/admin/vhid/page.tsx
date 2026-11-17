import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin, pendingIndex } from "@/lib/admin";
import CodeForm from "./CodeForm";
import SignInForm from "./SignInForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Вхід — адміністрування",
  robots: { index: false, follow: false },
};

export default async function AdminSignInPage({ searchParams }: { searchParams: Promise<{ krok?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  // Другий крок — лише якщо пароль справді вже правильний (підписана cookie на 5 хв)
  const code = (await searchParams).krok === "kod" && (await pendingIndex()) !== null;

  return (
    <section className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{code ? "Код підтвердження" : "Вхід для майстра"}</h1>
        {code ? <CodeForm /> : <SignInForm />}
      </div>
    </section>
  );
}
