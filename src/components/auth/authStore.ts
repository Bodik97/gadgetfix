"use client";

import { useSyncExternalStore } from "react";

/**
 * Стан входу без самого Clerk. Скрипти Clerk (~400 КБ) вантажимо лише тим,
 * кому він потрібен: хто вже увійшов, хто натиснув «Вхід», і в кабінеті.
 * Решта компонентів (шапка, нижнє меню, форма відгуку) читає стан звідси.
 */
type Store = {
  /** Clerk завантажився — далі стан бере звідти */
  clerkLoaded: boolean;
  clerkSignedIn: boolean;
  /** Clerk попросили підвантажити: навели чи натиснули «Вхід» */
  wanted: boolean;
  /** Вікно входу відкрите */
  modalOpen: boolean;
};

let store: Store = { clerkLoaded: false, clerkSignedIn: false, wanted: false, modalOpen: false };
const listeners = new Set<() => void>();

function set(patch: Partial<Store>) {
  store = { ...store, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Clerk лишає cookie __client_uat (і __client_uat_<суфікс>): «0» — не увійшов,
 * позначка часу — увійшов. Без cookie — новий відвідувач.
 */
export function hasSessionHint(): boolean {
  return document.cookie
    .split(";")
    .some((c) => /^\s*__client_uat(_[^=]*)?=/.test(c) && !/=\s*0?\s*$/.test(c));
}

export type AuthState = { isLoaded: boolean; isSignedIn: boolean };

// Сталі обʼєкти: useSyncExternalStore порівнює знімки за посиланням
const LOADING: AuthState = { isLoaded: false, isSignedIn: false };
const SIGNED_OUT: AuthState = { isLoaded: true, isSignedIn: false };
const SIGNED_IN: AuthState = { isLoaded: true, isSignedIn: true };

function authSnapshot(): AuthState {
  if (store.clerkLoaded) return store.clerkSignedIn ? SIGNED_IN : SIGNED_OUT;
  // Сесія є, а Clerk ще вантажиться — чекаємо, щоб не показати «Вхід» тому, хто увійшов
  return hasSessionHint() ? LOADING : SIGNED_OUT;
}

/** Замість useUser() там, де потрібно лише «увійшов чи ні» */
export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribe, authSnapshot, () => LOADING);
}

/** Чи підвантажувати Clerk на публічній сторінці */
export function useClerkWanted(): boolean {
  return useSyncExternalStore(subscribe, () => store.wanted || hasSessionHint(), () => false);
}

export function useSignInModal(): boolean {
  return useSyncExternalStore(subscribe, () => store.modalOpen, () => false);
}

/** Почати вантажити Clerk заздалегідь — коли курсор чи фокус на кнопці «Вхід» */
export function prepareSignIn() {
  if (!store.wanted) set({ wanted: true });
}

export function openSignIn() {
  set({ wanted: true, modalOpen: true });
}

export function closeSignIn() {
  set({ modalOpen: false });
}

/** Clerk повідомляє свій стан — викликає лише міст усередині ClerkProvider */
export function reportClerk(loaded: boolean, signedIn: boolean) {
  if (store.clerkLoaded !== loaded || store.clerkSignedIn !== signedIn) {
    set({ clerkLoaded: loaded, clerkSignedIn: signedIn });
  }
}
