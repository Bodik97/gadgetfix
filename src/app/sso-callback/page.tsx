import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Повернення з Google після «Увійти через Google». Clerk завершує вхід
 * (або реєстрацію, якщо людина тут уперше) і веде в кабінет.
 * Якщо Clerk просить ще щось підтвердити — на сторінку входу.
 */
export default function SsoCallbackPage() {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--text-2)" }}>
      <p>Завершуємо вхід…</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/kabinet"
        signUpFallbackRedirectUrl="/kabinet"
        signInUrl="/vhid"
        signUpUrl="/vhid"
      />
    </div>
  );
}
