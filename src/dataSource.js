// ==========================================
// Sumber data terpisah (dipilih via toggle)
//   'tunnel' -> data realtime langsung dari MikroTik via VPN tunnel (API /api/mikrotik)
//   'sheets' -> data dari Google Sheets (cadangan)
//
// Setiap loader mengembalikan:
//   { rows, source, syncedAt, activeCount?, onlineCount?, tunnelError? }
//   rows berbentuk { Tanggal, Username, 'Total (MB)' } (kumulatif, sama seperti CSV)
// ==========================================

import Papa from 'papaparse';
import { HOTSPOT_CSV_URL, DEFAULT_DATA_MODE } from './config.js';
import { fetchRouterUsers } from './routerApi.js';

const BYTES_PER_MB = 1024 * 1024;

export function bytesToMB(bytes) {
  const n = Number(bytes) || 0;
  return parseFloat((n / BYTES_PER_MB).toFixed(2));
}

// Label tanggal lokal format dashboard: DD/MM/YYYY
function todayLabel(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Baca seluruh baris tab "Hotspot" dari Google Sheets (publish CSV)
export function fetchSheetRows() {
  return new Promise((resolve, reject) => {
    Papa.parse(HOTSPOT_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = (res.data || [])
          .filter((r) => r && r.Username && String(r.Username).trim() !== '')
          .map((r) => ({ ...r, Username: String(r.Username).trim() }));
        resolve(rows);
      },
      error: (err) => reject(err instanceof Error ? err : new Error('Gagal membaca CSV Google Sheets.'))
    });
  });
}

// Ubah daftar user MikroTik (kumulatif bytes) menjadi baris tabel hotspot
function usersToLiveRows(users) {
  const label = todayLabel();
  return users.map((u) => ({
    Tanggal: label,
    Username: u.name,
    'Total (MB)': bytesToMB(u.totalBytes),
    __live: true
  }));
}

// Ambil data dari Google Sheets (mode 'sheets')
export async function loadFromSheets() {
  const rows = await fetchSheetRows();
  return { rows, source: 'sheets', syncedAt: new Date().toISOString(), tunnelError: '' };
}

// Ambil data realtime dari router via tunnel (mode 'tunnel')
export async function loadFromTunnel() {
  let res;
  try {
    res = await fetchRouterUsers();
  } catch (err) {
    throw new Error(
      err && err.message ? err.message : 'Tunnel MikroTik tidak dapat dihubungi.',
      { cause: err }
    );
  }
  const data = (res && res.data) || {};
  const users = data.users || [];
  const rows = usersToLiveRows(users);
  return {
    rows,
    source: 'tunnel',
    syncedAt: data.syncedAt || new Date().toISOString(),
    activeCount: Number(data.activeCount) || 0,
    onlineCount: users.filter((u) => u.online).length,
    tunnelError: ''
  };
}

// Loader utama: pilih mode (default dari config)
export function loadHotspotRows(mode = DEFAULT_DATA_MODE) {
  return mode === 'sheets' ? loadFromSheets() : loadFromTunnel();
}
