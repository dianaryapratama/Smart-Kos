import { QUOTA_WASPADA_FACTOR } from '../config.js';

export const AVATAR_COLORS = ['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-violet-500'];

export function mbToGB(mb) {
  const gb = mb / 1024;
  return gb >= 100 ? gb.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : gb.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

export function catOf(total, avg) {
  if (total <= avg) return 'normal';
  if (total <= avg * QUOTA_WASPADA_FACTOR) return 'waspada';
  return 'abnormal';
}

export function formatDateTs(ts) {
  if (!ts || !Number.isFinite(ts)) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${String(d.getFullYear()).slice(2)}`;
}

// Parse "DD/MM/YYYY [HH:mm]" atau "YYYY-MM-DD" -> timestamp (konsisten dengan dashboard)
export function parseDateTs(str) {
  if (!str) return 0;
  const s = String(str).trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

// Ambil baris mentah { username, mb, ts }. 'Total (MB)' bersifat KUMULATIF dari MikroTik.
export function parseCsvRows(data) {
  const out = [];
  for (const r of data) {
    if (!r || typeof r !== 'object' || !Object.keys(r).length) continue;
    const username = r.Username ?? r.username ?? r.Nama ?? r.User ?? '';
    const totalRaw = r['Total (MB)'] ?? r['Total MB'] ?? r.Total ?? r.MB ?? '';
    if (username) {
      const raw = String(totalRaw).replace(/[^0-9.,]/g, '').replace(/,/g, '.');
      const dotParts = raw.split('.');
      const numeric = dotParts.length > 1 && dotParts[dotParts.length - 1].length === 3 ? raw.replace(/\./g, '') : raw;
      const mb = parseFloat(numeric);
      if (!Number.isNaN(mb)) {
        out.push({ username: String(username), mb, ts: parseDateTs(r.Tanggal ?? r.Date ?? '') });
      }
    }
  }
  return out;
}

// Pemakaian per user = NILAI KUMULATIF TERAKHIR (record dengan tanggal terbaru),
// supaya sama persis dengan angka di dashboard admin.
export function aggregateByUser(rows) {
  const map = new Map();
  for (const { username, mb, ts } of rows) {
    const key = username.toLowerCase();
    const cur = map.get(key) || { name: username, latest: 0, n: 0, ts: 0, firstTs: Infinity, lastTs: -Infinity };
    cur.n += 1;
    if (ts > cur.ts || (ts === cur.ts && mb > cur.latest)) {
      cur.latest = mb;
      cur.ts = ts;
    }
    if (ts !== 0) {
      if (ts < cur.firstTs) cur.firstTs = ts;
      if (ts > cur.lastTs) cur.lastTs = ts;
    }
    map.set(key, cur);
  }
  const users = [...map.values()].sort((a, b) => b.latest - a.latest);
  const avg = users.length ? users.reduce((s, u) => s + u.latest, 0) / users.length : 0;
  const maxTotal = Math.max(users[0] ? users[0].latest : 0, 1);
  return {
    users: users.map((u, i) => ({
      ...u,
      cat: catOf(u.latest, avg),
      pct: u.latest / maxTotal,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length]
    })),
    avg,
    total: users.length
  };
}