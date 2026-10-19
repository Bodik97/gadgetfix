import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Повернення з Google після «Увійти через Google». Clerk завершує вхід
 * і веде в кабінет, а нового клієнта — у форму замовлення зі знижкою 5%.
 * Якщо Clerk просить ще щось підтвердити — на сторінку входу.
 */
export default function SsoCallbackPage() {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--text-2)" }}>
      <p>Завершуємо вхід…</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/kabinet"
        signUpFallbackRedirectUrl="/moi-remonty?vitayemo=1"
        signInUrl="/vhid"
        signUpUrl="/vhid"
      />
    </div>
  );
}
