import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import AuthShell from "@/components/auth/AuthShell";
import SignInForm from "@/components/auth/SignInForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Вхід",
  description: "Вхід для клієнтів GadgetFix — статус ремонту, посилка та історія заявок.",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  // Уже увійшли — форма тут ні до чого
  const { userId } = await auth();
  if (userId) redirect("/kabinet");

  return (
    <section className={styles.wrap}>
      <div className={styles.inner}>
        <AuthShell
          titleAs="h1"
          title="Вхід або реєстрація"
          lead="Пошта й пароль — або Google. Заходите вперше: акаунт створимо автоматично."
        >
          <SignInForm bare />
        </AuthShell>
      </div>
    </section>
  );
}
