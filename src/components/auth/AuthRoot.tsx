"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useClerkWanted } from "./authStore";

// Окремий файл: на публічних сторінках новому відвідувачу Clerk не вантажиться зовсім
const ClerkShell = dynamic(() => import("./ClerkShell"));

/** Сторінки, яким Clerk потрібен у самому дереві: кабінет і вхід */
const CLERK_ROUTES = ["/kabinet", "/moi-remonty", "/moi-znyzhky", "/profil", "/vhid", "/sso-callback"];

/**
 * Замість ClerkProvider на весь сайт. Кабінет і вхід — у провайдері, як раніше.
 * Публічні сторінки рендеряться без нього, а Clerk поруч підвантажується, лише
 * коли людина вже увійшла або тягнеться до «Вхід». Окремо від дерева сторінки —
 * щоб поява Clerk не перебудовувала сторінку, на якій людина вже є.
 */
export default function AuthRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wanted = useClerkWanted();

  if (CLERK_ROUTES.some((p) => pathname.startsWith(p))) {
    return <ClerkShell>{children}</ClerkShell>;
  }

  return (
    <>
      {children}
      {wanted && <ClerkShell />}
    </>
  );
}
