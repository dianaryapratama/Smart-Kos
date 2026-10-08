// ==========================================
// Model data & konteks untuk Chat AI (tanpa login)
// Pipeline identik dengan dashboard admin supaya angka konsisten.
// ==========================================

import Papa from 'papaparse';
import { HOTSPOT_CSV_URL } from './config.js';
import { parseDateTs } from './landing/kuota.js';

const round = (n) => parseFloat(Number(n).toFixed(2));
const fmt = (n) => Number(n).toLocaleString('id-ID');
const fmtGB = (mb) => parseFloat(mb / 1024).toFixed(2);

function parseTotalMB(value) {
  const raw = String(value ?? '').replace(/[^0-9.,]/g, '').replace(/,/g, '.');
  const dotParts = raw.split('.');
  const numeric = dotParts.length > 1 && dotParts[dotParts.length - 1].length === 3 ? raw.replace(/\./g, '') : raw;
  const n = parseFloat(numeric);
  return Number.isNaN(n) ? 0 : n;
}

// Pipeline sama seperti useMemo di App.jsx: kumulatif MikroTik -> selisih harian/reset -> latest per user
export function buildDataModel(rows) {
  const groups = {};
  rows.forEach(row => {
    const username = String(row.Username ?? row.username ?? '').trim();
    if (!username) return;
    (groups[username] ||= []).push({
      Tanggal: row.Tanggal,
      ts: parseDateTs(row.Tanggal),
      totalVal: parseTotalMB(row['Total (MB)'] ?? row['Total MB'] ?? row.Total ?? row.MB)
    });
  });

  const daily = [];
  const trendByDate = {};
  const latest = {};

  Object.entries(groups).forEach(([user, records]) => {
    records.sort((a, b) => a.ts - b.ts);
    records.forEach((rec, i) => {
      let pure = i === 0 ? 0 : rec.totalVal - records[i - 1].totalVal;
      if (pure < 0) pure = rec.totalVal; // reset kuota
      daily.push({
        Tanggal: rec.Tanggal,
        ts: rec.ts,
        Username: user,
        DailyMB: round(pure),
        CumulativeMB: round(rec.totalVal)
      });
      const dayKey = String(rec.Tanggal).trim().split(' ')[0];
      const t = (trendByDate[dayKey] ||= { Tanggal: dayKey, ts: rec.ts, harian: 0, users: new Set() });
      t.harian += pure;
      t.users.add(user);
    });
    latest[user] = records[records.length - 1].totalVal;
  });

  const trend = Object.values(trendByDate)
    .sort((a, b) => a.ts - b.ts)
    .map(item => ({
      Tanggal: item.Tanggal,
      ts: item.ts,
      PemakaianHarian: round(item.harian),
      aktif: item.users.size
    }));

  const bar = Object.entries(latest)
    .map(([name, totalMB]) => ({ name, totalMB: round(totalMB), gb: round(totalMB / 1024) }))
    .sort((a, b) => b.totalMB - a.totalMB);

  return { daily, trend, bar, rawRows: rows.length };
}

export function buildAnalytics(model) {
  const bar = model.bar;
  const totalUsers = bar.length;
  const totalMB = bar.reduce((s, r) => s + r.totalMB, 0);
  const avgMB = totalUsers ? totalMB / totalUsers : 0;
  const activeDays = model.trend.length;
  const totalDailyMB = model.daily.reduce((s, r) => s + r.DailyMB, 0);
  const avgDailyMB = activeDays ? totalDailyMB / activeDays : 0;
  const peakDay = model.trend.reduce((m, i) => (!m || i.PemakaianHarian > m.PemakaianHarian ? i : m), null);
  return {
    totalRooms: totalUsers,
    totalMB: round(totalMB),
    totalGB: round(totalMB / 1024),
    avgMB: round(avgMB),
    avgGB: round(avgMB / 1024),
    uniqueUsers: totalUsers,
    records: model.rawRows,
    activeDays,
    avgDailyMB: round(avgDailyMB),
    avgDailyGB: round(avgDailyMB / 1024),
    peakLabel: peakDay
      ? `${peakDay.Tanggal} (${fmt(peakDay.PemakaianHarian)} MB · ${fmtGB(peakDay.PemakaianHarian)} GB)`
      : null,
    top: bar.slice(0, 5).map(r => ({ name: r.name, mb: r.totalMB, gb: r.gb }))
  };
}

// Prompt mendalam: bawa tabel kamar & tabel harian langsung ke model Groq
export function buildDeepSystemPrompt(model, analytics) {
  const a = analytics || {};
  const m = model || { bar: [], trend: [] };

  const rowsBar = m.bar.slice(0, 40).map(r =>
    `- ${r.name}: ${fmt(r.totalMB)} MB (#${fmt(r.gb)} GB)`
  ).join('\n');
  const extraBar = m.bar.length > 40 ? `\n... dan ${m.bar.length - 40} kamar lainnya (total ${a.totalRooms} kamar)` : '';

  const rowsTrend = m.trend.slice(-45).map(t =>
    `- ${t.Tanggal}: ${fmt(t.PemakaianHarian)} MB harian · ${t.aktif} kamar aktif`
  ).join('\n');
  const extraTrend = m.trend.length > 45 ? `\n... dan ${m.trend.length - 45} hari lainnya (total ${a.activeDays} hari)` : '';

  const peak = a.peakLabel || 'belum ada';

  return `Kamu adalah "Asisten AI Smart Kost" — asisten digital yang ramah dan cerdas, Bahasa Indonesia, membantai soal apa saja seperti chatbot umum, tapi punya akses DATA SPREADSHEET pemakaian internet kost sehingga bisa menjawab detail tentang data.
Sumber data: Google Sheets tab "Hotspot", kolom Tanggal/Username/Total (MB) yang diambil dari MikroTik secara kumulatif.

CARA MENJAWAB:
- Pertanyaan umum (apa saja: tips, pengetahuan, obrolan, cara pakai aplikasi) → jawab dengan alami dan membantu, seperti chatbot pada umumnya. Tidak perlu membahas data.
- Pertanyaan tentang DATA kost (kuota, pemakaian, kamar, tren harian, perbandingan, terboros) → jawab MENDALAM berdasarkan tabel & ringkasan di bawah: sebut angka nyata, nama kamar, hitung perbandingan bila memungkinkan.
- Jika data yang ditanya belum ada/kosong → katakan "Data masih kosong" lalu tetap tawarkan bantuan umum.

RINGKASAN TERKINI:
- Kamar terpantau: ${a.totalRooms ?? 0} · total pemakaian: ${a.totalGB ?? 0} GB (${fmt(a.totalMB ?? 0)} MB)
- Rata-rata per kamar: ${a.avgGB ?? 0} GB · rata-rata harian: ${a.avgDailyGB ?? 0} GB
- Hari terpantau: ${a.activeDays ?? 0} · puncak harian: ${peak}
- Jumlah record spreadsheet: ${a.records ?? 0}

DAFTAR KAMAR (pemakaian kumulatif, diurutkan terbesar):
${rowsBar}${extraBar}

TABEL HARIAN (pemakaian per tanggal):
${rowsTrend || '- belum ada data harian'}${extraTrend}

ATURAN:
1. JANGAN mengarang angka pemakaian kost di luar tabel/ringkasan — hanya pakai data di atas untuk klaim data.
2. Untuk hal di luar data kost, bebas menjawab seperti chatbot umum (tidak perlu menolak).
3. Jawab dengan struktur rapi: gunakan **bold** untuk poin penting, list "- " bila 3+ poin.
4. Tetap ringkas tapi mendalam: maksimal ~8 kalimat untuk jawaban data, lebih longgar untuk topik umum.
5. Bahasa Indonesia yang hangat dan profesional.`;
}

// ---------------- Fetch data (dibagikan antar halaman via cache) ----------------

function fetchRows(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data || []),
      error: (err) => reject(err)
    });
  });
}

let chatDataPromise = null;

export function getChatData(refresh = false) {
  if (!chatDataPromise || refresh) {
    chatDataPromise = (async () => {
      const rows = await fetchRows(HOTSPOT_CSV_URL);
      const model = buildDataModel(rows);
      const analytics = buildAnalytics(model);
      return { analytics, model, at: Date.now() };
    })().catch((err) => {
      chatDataPromise = null; // gagal -> boleh dicoba lagi nanti
      throw err;
    });
  }
  return chatDataPromise;
}