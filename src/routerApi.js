const BASE = import.meta.env.VITE_MIKROTIK_API || '/api/mikrotik';

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Tidak dapat menghubungi server API. Periksa koneksi internet.');
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('Respons server tidak valid.');
  }
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Permintaan gagal (${res.status}).`);
  }
  return json;
}

export const fetchRouterUsers = () => request(`${BASE}?action=users`, { cache: 'no-store' });

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
