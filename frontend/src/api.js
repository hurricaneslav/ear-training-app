const API_BASE = import.meta.env.VITE_API_BASE || 'https://ear-training-app-production.up.railway.app';

function getUserId() {
  const tg = window.Telegram?.WebApp;
  const id = tg?.initDataUnsafe?.user?.id;
  return id || 0; // 0 = dev/browser fallback
}

async function req(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  getUserId,
  getSettings: () => req(`/api/${getUserId()}/settings`),
  putSettings: (settings) =>
    req(`/api/${getUserId()}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  getProgress: () => req(`/api/${getUserId()}/progress`),
  postAnswer: (payload) =>
    req(`/api/${getUserId()}/answer`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
