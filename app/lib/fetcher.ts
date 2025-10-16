// app/lib/fetcher.ts
export async function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include', // ✅ 쿠키(token) 반드시 포함
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}
