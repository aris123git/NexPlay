import * as SecureStore from 'expo-secure-store';
import type { Session } from './api';

const KEY = 'nexplay.session';

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(KEY);
}
