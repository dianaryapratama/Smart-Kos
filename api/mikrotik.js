import crypto from 'node:crypto';
import pkg from 'node-routeros';

const { RouterOSAPI } = pkg;

const DEFAULT_PORT = 8728;
// Hanya ambil user hotspot dengan profile ini (kosongkan untuk semua profile).
const HOTSPOT_PROFILE = process.env.MIKROTIK_HOTSPOT_PROFILE ?? 'KOST-50';
// Harus lebih kecil dari timeout klien (VITE_MIKROTIK_TIMEOUT_MS) agar server
// selalu mengirim pesan error yang jelas sebelum browser membatalkan permintaan.
const CONNECT_TIMEOUT_MS = 20000;

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

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const firstOf = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : {});

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
  const usersQuery = HOTSPOT_PROFILE ? ['?profile=' + HOTSPOT_PROFILE] : [];
  const [users, active] = await Promise.all([
    conn.write('/ip/hotspot/user/print', usersQuery),
    conn.write('/ip/hotspot/active/print')
  ]);
  const activeByUser = new Map(active.map((a) => [a.user, a]));
  const data = users
    .map((u) => mapUser(u, activeByUser))
    .sort((a, b) => b.totalBytes - a.totalBytes);
  const activeCount = data.filter((u) => u.online).length;
  return { users: data, profile: HOTSPOT_PROFILE, activeCount, syncedAt: new Date().toISOString() };
}

// Ambil seluruh metrik monitoring jaringan (untuk mode realtime only).
// Setiap bagian dibungkus try/catch agar fitur yang tidak tersedia di perangkat
// tertentu tidak menggagalkan keseluruhan respons.
async function readStats(conn) {
  const safe = async (cmd, args = []) => {
    try {
      return await conn.write(cmd, args);
    } catch {
      return null;
    }
  };

  const [identity, resource, health, board, ifaces1, queues, conns, leases, netwatch, logs, wireless] =
    await Promise.all([
      safe('/system/identity/print'),
      safe('/system/resource/print'),
      safe('/system/health/print'),
      safe('/system/routerboard/print'),
      safe('/interface/print'),
      safe('/queue/simple/print'),
      safe('/ip/firewall/connection/print', ['=.proplist=.id']),
      safe('/ip/dhcp-server/lease/print', ['=.proplist=.id,address,status']),
      safe('/tool/netwatch/print'),
      safe('/log/print', ['=.proplist=time,topics,message']),
      safe('/interface/wireless/registration-table/print')
    ]);

  // Sampel kedua untuk menghitung kecepatan TX/RX aktual (bytes/detik).
  const t1 = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const ifaces2 = (await safe('/interface/print')) || [];
  const dt = Math.max((Date.now() - t1) / 1000, 0.5);

  const prevByName = new Map((ifaces1 || []).map((i) => [i.name, i]));
  const interfaces = (ifaces2.length ? ifaces2 : ifaces1 || []).map((i) => {
    const prev = prevByName.get(i.name);
    const rxBytes = num(i['rx-byte']);
    const txBytes = num(i['tx-byte']);
    return {
      name: i.name,
      defaultName: i['default-name'] || '',
      type: i.type || '',
      running: i.running === 'true',
      disabled: i.disabled === 'true',
      slave: i.slave === 'true',
      rxRate: prev ? Math.max(0, (rxBytes - num(prev['rx-byte'])) / dt) : 0,
      txRate: prev ? Math.max(0, (txBytes - num(prev['tx-byte'])) / dt) : 0,
      rxBytes,
      txBytes,
      rxPackets: num(i['rx-packet']),
      txPackets: num(i['tx-packet'])
    };
  });

  const r = firstOf(resource);
  const h = firstOf(health);
  const b = firstOf(board);
  const system = {
    uptime: r.uptime || '',
    version: r.version || '',
    boardName: r['board-name'] || b['board-name'] || '',
    model: b.model || '',
    architecture: r['architecture-name'] || '',
    platform: r.platform || '',
    serialNumber: b['serial-number'] || '',
    currentFirmware: b['current-firmware'] || '',
    upgradeFirmware: b['upgrade-firmware'] || '',
    cpuLoad: num(r['cpu-load']),
    cpuCount: num(r['cpu-count']),
    cpuFrequency: num(r['cpu-frequency']),
    cpuModel: r.cpu || '',
    freeMemory: num(r['free-memory']),
    totalMemory: num(r['total-memory']),
    freeHdd: num(r['free-hdd-space']),
    totalHdd: num(r['total-hdd-space']),
    temperature: h.temperature !== undefined ? num(h.temperature) : null,
    voltage: h.voltage !== undefined ? num(h.voltage) : null
  };

  const queueList = (queues || [])
    .map((q) => {
      const [rateIn, rateOut] = String(q.rate || '0/0').split('/').map(num);
      const [bytesIn, bytesOut] = String(q.bytes || '0/0').split('/').map(num);
      return {
        name: q.name || '',
        target: q.target || '',
        maxLimit: q['max-limit'] || '0/0',
        rateIn,
        rateOut,
        bytesIn,
        bytesOut,
        dynamic: q.dynamic === 'true',
        disabled: q.disabled === 'true'
      };
    })
    .sort((x, y) => y.rateIn + y.rateOut - (x.rateIn + x.rateOut));

  const leaseList = leases || [];
  const netwatchList = (netwatch || []).map((n) => ({
    host: n.host || '',
    status: n.status || 'unknown',
    since: n.since || '',
    interval: n.interval || '',
    disabled: n.disabled === 'true'
  }));

  const allLogs = logs || [];
  const logList = allLogs
    .slice(-80)
    .reverse()
    .map((l) => ({ time: l.time || '', topics: l.topics || '', message: l.message || '' }));

  const wirelessList = (wireless || []).map((w) => ({
    interface: w.interface || '',
    mac: w['mac-address'] || '',
    signal: w['signal-strength'] || '',
    uptime: w.uptime || '',
    bytesIn: num(w['bytes-in']),
    bytesOut: num(w['bytes-out'])
  }));

  return {
    identity: firstOf(identity).name || '',
    system,
    interfaces,
    queues: queueList,
    connections: (conns || []).length,
    dhcp: { total: leaseList.length, bound: leaseList.filter((l) => l.status === 'bound').length },
    netwatch: netwatchList,
    logs: logList,
    wireless: wirelessList,
    syncedAt: new Date().toISOString()
  };
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

    if (action === 'stats') {
      const data = await withRouter(readStats);
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
    const raw = (err && (err.message || err.error || err.errno)) || (typeof err === 'string' ? err : '');
    const message = raw || 'Gagal menghubungi MikroTik.';
    const offline = /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|timeout|socket hang up|closed|econnreset/i.test(String(message));
    return res.status(offline ? 504 : 500).json({
      success: false,
      message: offline
        ? 'Tidak dapat terhubung ke MikroTik. Pastikan tunnel VPN, port API, dan kredensial sudah benar.'
        : `Gagal menghubungi MikroTik: ${message}`
    });
  }
}
