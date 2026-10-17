import crypto from 'node:crypto';
import pkg from 'node-routeros';

const { RouterOSAPI } = pkg;

const DEFAULT_PORT = 8728;
const CONNECT_TIMEOUT_MS = 15000;

function routerConfig() {
  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER;
  const password = process.env.MIKROTIK_PASS;
  if (!host || !user || !password) {
    throw new Error(
      'Konfigurasi MikroTik belum lengkap. Set env MIKROTIK_HOST, MIKROTIK_USER, dan MIKROTIK_PASS di Vercel.'
    );
  }
  return {
    host,
    user,
    password,
    port: Number(process.env.MIKROTIK_PORT) || DEFAULT_PORT,
    timeout: CONNECT_TIMEOUT_MS
  };
}

async function withRouter(fn) {
  const conn = new RouterOSAPI(routerConfig());
  await conn.connect();
  try {
    return await fn(conn);
  } finally {
    try {
      conn.close();
    } catch {
      /* ignore */
    }
  }
}

const toBytes = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const mapUser = (row, active) => {
  const bytesIn = toBytes(row['bytes-in']);
  const bytesOut = toBytes(row['bytes-out']);
  const session = active.get(row.name);
  return {
    id: row['.id'],
    name: row.name || '',
    profile: row.profile || '',
    comment: row.comment || '',
    disabled: row.disabled === 'true' || row.disabled === true,
    uptime: row.uptime || '',
    limitBytesTotal: toBytes(row['limit-bytes-total']),
    bytesIn,
    bytesOut,
    totalBytes: bytesIn + bytesOut,
    online: !!session,
    address: session ? session.address || '' : '',
    macAddress: session ? session['mac-address'] || '' : '',
    sessionUptime: session ? session.uptime || '' : '',
    sessionBytesIn: session ? toBytes(session['bytes-in']) : 0,
    sessionBytesOut: session ? toBytes(session['bytes-out']) : 0
  };
};

const sameSecret = (a, b) => {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

async function readUsage(conn) {
  const [users, active] = await Promise.all([
    conn.write('/ip/hotspot/user/print'),
    conn.write('/ip/hotspot/active/print')
  ]);
  const activeByUser = new Map(active.map((a) => [a.user, a]));
  const data = users
    .map((u) => mapUser(u, activeByUser))
    .sort((a, b) => b.totalBytes - a.totalBytes);
  return { users: data, activeCount: active.length, syncedAt: new Date().toISOString() };
}

async function setDisabled(conn, { name, id, disabled }) {
  const query = id ? ['?.id=' + id] : name ? ['?name=' + name] : null;
  if (!query) throw new Error('Parameter "id" atau "name" wajib diisi.');
  const found = await conn.write('/ip/hotspot/user/print', query);
  if (!found.length) throw new Error(`User hotspot "${name || id}" tidak ditemukan.`);

  const target = found[0];
  await conn.write('/ip/hotspot/user/set', ['=.id=' + target['.id'], '=disabled=' + (disabled ? 'yes' : 'no')]);

  let kicked = 0;
  if (disabled) {
    const sessions = await conn.write('/ip/hotspot/active/print');
    const mine = sessions.filter((s) => s.user === target.name);
    for (const s of mine) await conn.write('/ip/hotspot/active/remove', ['=.id=' + s['.id']]);
    kicked = mine.length;
  }
  return { kicked, name: target.name };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const action = (req.query && req.query.action) || (req.body && req.body.action) || 'users';

  try {
    if (action === 'users') {
      const data = await withRouter(readUsage);
      return res.status(200).json({ success: true, data });
    }

    if (action === 'disable' || action === 'enable') {
      const expected = process.env.MIKROTIK_ADMIN_PASSWORD;
      if (!expected) {
        return res.status(500).json({ success: false, message: 'Env MIKROTIK_ADMIN_PASSWORD belum diset di server.' });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!sameSecret(body.password, expected)) {
        return res.status(401).json({ success: false, message: 'Password admin salah.' });
      }
      const result = await withRouter((conn) =>
        setDisabled(conn, { name: body.name, id: body.id, disabled: action === 'disable' })
      );
      return res.status(200).json({
        success: true,
        message: action === 'disable'
          ? `User "${result.name}" dinonaktifkan${result.kicked ? ` (${result.kicked} sesi aktif diputus)` : ''}.`
          : `User "${result.name}" diaktifkan kembali.`
      });
    }

    return res.status(400).json({ success: false, message: `Aksi "${action}" tidak dikenal.` });
  } catch (err) {
    const message = err && err.message ? err.message : 'Gagal menghubungi MikroTik.';
    const offline = /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|timeout|socket hang up/i.test(message);
    return res.status(offline ? 504 : 500).json({
      success: false,
      message: offline
        ? 'Tidak dapat terhubung ke MikroTik. Pastikan tunnel VPN, port API (8728), dan kredensial sudah benar.'
        : message
    });
  }
}
