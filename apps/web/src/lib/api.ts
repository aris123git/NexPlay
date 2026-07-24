const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    countryCode: string;
    level: number;
    xp: number;
    avatarUrl?: string | null;
    nexplayId?: string | null;
    nexplayTag?: string;
  };
};

const SESSION_KEY = 'nexplay.session';

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function isLitePreferred(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body.classList.contains('low-bandwidth');
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Client HTTP avec retry/backoff et mode lite (faible connexion).
 */
export async function api<T>(
  path: string,
  options: RequestInit & { token?: string; retries?: number; timeoutMs?: number } = {},
): Promise<T> {
  const lite = isLitePreferred();
  const retries = options.retries ?? (lite ? 3 : 1);
  const timeoutMs = options.timeoutMs ?? (lite ? 20_000 : 12_000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (lite) headers['X-NexPlay-Lite'] = '1';

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(new Error((data as { error?: string }).error ?? 'REQUEST_FAILED'), {
          status: res.status,
          data,
        });
      }
      return data as T;
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      if (attempt < retries) await sleep(400 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('REQUEST_FAILED');
}

export { API_URL };
