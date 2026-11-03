import { useSyncExternalStore } from "react";
import type { AuthSession, SessionUser } from "@/services/types";

const SESSION_KEY = "tutoria.session";

interface SessionState {
  hydrated: boolean;
  user: SessionUser | null;
  accessToken: string | null;
}

let state: SessionState = { hydrated: false, user: null, accessToken: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function hydrate() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage is only used to remove tokens saved by older frontend versions.
  }
  state = {
    hydrated: true,
    user: null,
    accessToken: null,
  };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // The refresh cookie restores authentication; local storage is never trusted.
  if (typeof window !== "undefined" && !state.hydrated) hydrate();
  return () => listeners.delete(listener);
}

const serverSnapshot: SessionState = { hydrated: false, user: null, accessToken: null };

export function useSession() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => serverSnapshot,
  );
  return snapshot;
}

export function loginSession(session: AuthSession) {
  state = { hydrated: true, user: session.user, accessToken: session.accessToken };
  emit();
}

export function logoutSession() {
  state = { hydrated: true, user: null, accessToken: null };
  emit();
}

export function getAccessToken() {
  return state.accessToken;
}
