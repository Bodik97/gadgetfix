import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { isAdmin } from "@/lib/admin";
import SignInForm from "./SignInForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Вхід — адміністрування",
  robots: { index: false, follow: false },
};

export default async function AdminSignInPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <section className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Вхід для майстра</h1>
        {/* Clerk лише тут: він надсилає код на пошту й перевіряє його */}
        <ClerkProvider>
          <SignInForm />
        </ClerkProvider>
      </div>
    </section>
  );
}
