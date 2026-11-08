const BASE = import.meta.env.VITE_MIKROTIK_API || '/api/mikrotik';
const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_MIKROTIK_TIMEOUT_MS) || 30000;
const MAX_RETRIES = 1;

async function once(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('Koneksi ke tunnel MikroTik timeout.', { cause: err });
    throw new Error('Tidak dapat menghubungi server API. Periksa koneksi internet.', { cause: err });
  } finally {
    clearTimeout(timer);
  }
  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error('Respons server tidak valid.', { cause: err });
  }
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Permintaan gagal (${res.status}).`);
  }
  return json;
}

// Coba ulang sekali saat timeout / gagal koneksi (tunnel bisa lambat sesaat)
async function request(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await once(url, options, timeout);
    } catch (err) {
      lastErr = err;
      const retriable = /timeout|Tidak dapat menghubungi/i.test(err && err.message ? err.message : '');
      if (!retriable || attempt === MAX_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  throw lastErr;
}

export const fetchRouterUsers = () => request(`${BASE}?action=users`, { cache: 'no-store' });

export const fetchRouterStats = () => request(`${BASE}?action=stats`, { cache: 'no-store' });

export const setRouterUserDisabled = ({ id, name, disabled, password }) =>
  request(`${BASE}?action=${disabled ? 'disable' : 'enable'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, password })
  });

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '0 MB';
  const mb = n / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
