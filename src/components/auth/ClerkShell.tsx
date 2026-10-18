"use client";

import { useEffect } from "react";
import { ClerkProvider, useUser } from "@clerk/nextjs";
import AuthModal from "./AuthModal";
import { closeSignIn, reportClerk, useSignInModal } from "./authStore";

/**
 * Усе, що тягне Clerk: провайдер, вікно входу й міст до authStore. Живе в
 * окремому файлі, щоб AuthRoot підвантажував його лише тоді, коли треба.
 * children — сторінки, яким Clerk потрібен у самому дереві (кабінет, вхід).
 */
export default function ClerkShell({ children }: { children?: React.ReactNode }) {
  return (
    <ClerkProvider>
      <Bridge />
      {children}
      <SignInHost />
    </ClerkProvider>
  );
}

/** Передає стан Clerk у authStore — його читають шапка, нижнє меню, форма відгуку */
function Bridge() {
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    reportClerk(isLoaded, Boolean(isSignedIn));
  }, [isLoaded, isSignedIn]);

  // Провайдер зник (перейшли з кабінету на публічну сторінку) — стан знову з cookie
  useEffect(() => () => reportClerk(false, false), []);

  return null;
}

function SignInHost() {
  const open = useSignInModal();
  return <AuthModal open={open} onClose={closeSignIn} />;
}
