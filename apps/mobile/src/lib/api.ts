import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl ?? 'http://localhost:4000';

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    nexplayId?: string | null;
    nexplayTag?: string;
  };
};

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-NexPlay-Client': 'mobile',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error((data as { error?: string }).error ?? 'REQUEST_FAILED'), {
      status: res.status,
      data,
    });
  }
  return data as T;
}
