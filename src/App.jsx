import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import {
  Wifi, Users, LogOut, Activity, TrendingUp, Download, Bot, AlertTriangle,
  Printer, Lock, Moon, Sun, Menu, X, Server, Plus, Edit, Trash2, Save,
  BarChart2, PieChart as PieChartIcon, RefreshCw, Search
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, LabelList
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#94a3b8'];

// --- GANTI DENGAN URL CSV ANDA ---
const HOTSPOT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwYILZrPnVQUL19TMIDLnVbVcW_a0LTGxvvb2bJepITRGF5Ldk2joGEjHoJLULKTny63zrcB18r6Hp/pub?gid=123456&single=true&output=csv";
const ADMIN_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwYILZrPnVQUL19TMIDLnVbVcW_a0LTGxvvb2bJepITRGF5Ldk2joGEjHoJLULKTny63zrcB18r6Hp/pub?gid=1794162175&single=true&output=csv";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

// ==========================================
// HELPER FUNCTIONS
// ==========================================
const formatDataSize = (mbValue) => {
  const num = parseFloat(String(mbValue ?? '').replace(',', '.')); // dukung desimal koma (locale Indonesia)
  if (isNaN(num)) return "0 MB";
  if (Math.abs(num) >= 1024) return (num / 1024).toFixed(2) + " GB";
  return num.toFixed(2) + " MB";
};

// Singkat tanggal untuk label sumbu X grafik ( DD/MM/YYYY, YYYY-MM-DD, dll )
const shortDate = (str) => {
  const s = String(str ?? '').trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}`;
  return s.length > 10 ? s.slice(0, 10) : s;
};

const formatPct = (value) => `${Number(value || 0).toFixed(1).replace('.0', '')}%`;

// Label nilai pada grafik batang horizontal (posisi di ujung batang)
const BarValueLabel = ({ x, y, width, height, value }) => {
  const v = Array.isArray(value) ? value[0] : value;
  if (x == null || y == null || v == null) return null;
  return (
    <text x={x + (width || 0) + 8} y={y + (height || 0) / 2} fontSize={11} fontWeight={700}
      fill="#64748b" dominantBaseline="middle" className="tabular-nums">
      {formatDataSize(v)}
    </text>
  );
};

const downloadCSV = (data, filename) => {
  // BOM agar Excel membaca UTF-8 dengan benar
  const csv = '\uFEFF' + Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

async function hashPassword(password) {
  if (!window.crypto?.subtle) throw new Error('crypto-unavailable'); // butuh HTTPS / localhost
  const buf = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Parse "DD/MM/YYYY [HH:mm]" atau "YYYY-MM-DD" -> timestamp (bukan new Date(string) yang ambigu)
const parseTanggal = (str) => {
  if (!str) return 0;
  const s = String(str).trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
};

// ================= API GOOGLE APPS SCRIPT (sheet FUP) =================
const FUP_API_URL = "https://script.google.com/macros/s/AKfycbyqPrFZKU2U6ZmyYf29aaG6Q6Sr6kkUXd1dKqI8xkzhK2xy3wwOtAmXWNm9YOaCKleDqQ/exec";

const fupFromSheet = (r) => ({
  id: String(r.ID),
  isp: r.ISP || '',
  packageName: r.Paket || '',
  limitGB: Number(r.FUP_GB) || 0,
  manualUsedGB: Number(r.Terpakai_GB) || 0,
  isAutoSync: Boolean(r.Auto_Sync),
  periodStart: r.Periode_Mulai || '',
  periodEnd: r.Periode_Selesai || '',
  notes: r.Catatan || ''
});

const apiError = (err) =>
  err instanceof TypeError ? 'Tidak dapat terhubung ke Google Apps Script. Periksa koneksi & pengaturan deploy.' : err.message;

async function fupFetchAll() {
  const res = await fetch(`${FUP_API_URL}?action=list`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Gagal memuat data FUP.');
  return json.data.map(fupFromSheet);
}

// Content-Type text/plain agar tidak memicu CORS preflight (Apps Script tidak mendukung OPTIONS)
async function fupSend(body) {
  const res = await fetch(FUP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Permintaan gagal.');
  return json;
}

const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm";
const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition";
const tooltipStyle = (dark) => ({ backgroundColor: dark ? '#1e293b' : '#fff', borderRadius: '12px', border: 'none', color: dark ? '#e2e8f0' : '#0f172a' });
const EMPTY_FUP = { id: null, isp: '', packageName: '', limitGB: '', manualUsedGB: '', isAutoSync: true, periodStart: '', periodEnd: '', notes: '' };

const TAB_TITLES = {
  'dashboard': 'Visualisasi Data',
  'ai-analysis': 'Laporan AI & Tabel',
  'fup-monitor': 'Sistem FUP ISP',
  'rekap': 'Log Server Mentah'
};

const TAB_SUBTITLES = {
  'dashboard': 'Ringkasan trafik hotspot, distribusi beban & tren pemakaian',
  'ai-analysis': 'Rekap pemakaian harian per kamar, lengkap untuk export & cetak',
  'fup-monitor': 'Batas FUP tiap ISP, sisa kuota & pemakaian kumulatif',
  'rekap': 'Seluruh baris mentah yang diambil dari server hotspot'
};

// ============ KOMPONEN UI DASAR (presentasi saja) ============
const SectionHeader = ({ Icon, iconCls, title, subtitle, right }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
    <div className="min-w-0">
      <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
        {Icon && <Icon size={18} className={`${iconCls} shrink-0`} />} {title}
      </h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

const Pill = ({ tone = 'slate', children }) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
  };
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${tones[tone]}`}>{children}</span>;
};

const EmptyState = ({ Icon, title, hint }) => (
  <div className={`${card} p-10 text-center`}>
    <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
      <Icon size={22} />
    </div>
    <p className="font-semibold text-slate-600 dark:text-slate-300">{title}</p>
    {hint && <p className="text-sm text-slate-400 mt-1">{hint}</p>}
  </div>
);

const Field = ({ label, hint, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
    {children}
    {hint && <span className="text-[10px] text-slate-400 leading-snug">{hint}</span>}
  </label>
);

function App() {
  // ================= STATE =================
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem('kost50_user') !== null);
  const [currentUser, setCurrentUser] = useState(() => sessionStorage.getItem('kost50_user') || '');
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const [dataHotspot, setDataHotspot] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('kost50_dark');
    return saved !== null ? saved === '1' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  });

  const [fupList, setFupList] = useState([]);
  const [fupLoading, setFupLoading] = useState(false);
  const [fupSaving, setFupSaving] = useState(false);
  const [fupError, setFupError] = useState('');
  const [fupForm, setFupForm] = useState(EMPTY_FUP);
  const [isEditingFup, setIsEditingFup] = useState(false);

  const today = new Date();
  const todayDate = today.getDate();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const needsRecap = todayDate >= 30 || todayDate === lastDayOfMonth;
  const lockRemaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  // ================= EFFECTS =================
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('kost50_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    setFupLoading(true);
    setFupError('');
    fupFetchAll()
      .then(list => { if (!cancelled) setFupList(list); })
      .catch(err => { if (!cancelled) setFupError(apiError(err)); })
      .finally(() => { if (!cancelled) setFupLoading(false); });
    return () => { cancelled = true; };
  }, [isLoggedIn, reloadKey]);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  // ================= LOGIN =================
  const handleLogin = async (e) => {
    e.preventDefault();
    if (lockRemaining > 0) return;
    setIsLoggingIn(true);
    setLoginError('');

    const fail = (msg) => {
      setLoginError(msg);
      setIsLoggingIn(false);
    };
    const failCredential = () => {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCK_SECONDS * 1000);
        setNow(Date.now());
        setAttempts(0);
        fail(`Terlalu banyak percobaan. Coba lagi dalam ${LOCK_SECONDS} detik.`);
      } else {
        fail(`Username atau password salah! (${next}/${MAX_ATTEMPTS})`);
      }
    };

    try {
      const hashedInput = await hashPassword(loginInput.password);
      const username = loginInput.username.trim();
      Papa.parse(ADMIN_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const valid = results.data.find(a =>
            (a.Username || '').trim() === username &&
            (a.PasswordHash || '').trim().toLowerCase() === hashedInput
          );
          if (valid) {
            sessionStorage.setItem('kost50_user', username);
            setCurrentUser(username);
            setIsLoggedIn(true);
            setAttempts(0);
            setLoginInput({ username: '', password: '' });
            setIsLoggingIn(false);
          } else failCredential();
        },
        error: () => fail('Gagal terhubung ke database. Periksa koneksi internet.')
      });
    } catch (err) {
      fail(err.message === 'crypto-unavailable'
        ? 'Browser memerlukan HTTPS untuk enkripsi login.'
        : 'Error enkripsi browser.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('kost50_user');
    setIsLoggedIn(false);
    setCurrentUser('');
    setDataHotspot([]);
    setActiveTab('dashboard');
  };

  // ================= FETCH DATA =================
  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    setFetchError('');
    Papa.parse(HOTSPOT_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const valid = results.data
          .filter(row => row.Username && row.Username.trim() !== '')
          .map(row => ({ ...row, Username: row.Username.trim() }));
        setDataHotspot(valid);
        setLoading(false);
      },
      error: () => {
        setFetchError('Gagal memuat data hotspot. Periksa URL CSV atau koneksi internet.');
        setLoading(false);
      }
    });
  }, [isLoggedIn, reloadKey]);

  // ================= PERHITUNGAN DATA (memoized) =================
  const { aiDailyData, networkTrendData, donutChartData, chartDataBar } = useMemo(() => {
    const groups = {};
    dataHotspot.forEach(row => {
      const total = parseFloat(String(row['Total (MB)'] ?? '').replace(',', '.'));
      (groups[row.Username] ||= []).push({
        Tanggal: row.Tanggal,
        ts: parseTanggal(row.Tanggal),
        totalVal: isNaN(total) ? 0 : total
      });
    });

    const daily = [];
    const trendByDate = {};
    const latest = {};

    Object.entries(groups).forEach(([user, records]) => {
      records.sort((a, b) => a.ts - b.ts); // urutkan per user sebelum hitung selisih
      records.forEach((rec, i) => {
        let pure = i === 0 ? 0 : rec.totalVal - records[i - 1].totalVal;
        if (pure < 0) pure = rec.totalVal; // kuota di-reset (awal bulan)
        daily.push({
          Tanggal: rec.Tanggal, ts: rec.ts, Username: user,
          DailyMB: parseFloat(pure.toFixed(2)),
          CumulativeMB: rec.totalVal,
          IsBaseline: i === 0
        });
        const key = rec.Tanggal;
        (trendByDate[key] ||= { Tanggal: key, ts: rec.ts, harian: 0 }).harian += pure;
      });
      latest[user] = records[records.length - 1].totalVal; // data terbaru, bukan baris terakhir di sheet
    });

    let running = 0;
    const trend = Object.values(trendByDate).sort((a, b) => a.ts - b.ts).map(item => {
      running += item.harian;
      return {
        Tanggal: shortDate(item.Tanggal), // DD/MM konsisten untuk label sumbu X
        PemakaianHarian: parseFloat(item.harian.toFixed(2)),
        TotalKumulatif: parseFloat(running.toFixed(2))
      };
    });

    const bar = Object.entries(latest)
      .map(([name, v]) => ({ name, totalMB: parseFloat(v.toFixed(2)) }))
      .sort((a, b) => b.totalMB - a.totalMB);

    let donut = bar.map(b => ({ name: b.name, value: b.totalMB }));
    if (donut.length > 5) {
      const top4 = donut.slice(0, 4);
      top4.push({ name: 'Kamar Lainnya', value: donut.slice(4).reduce((s, i) => s + i.value, 0) });
      donut = top4;
    }

    daily.sort((a, b) => b.ts - a.ts || a.Username.localeCompare(b.Username));
    return { aiDailyData: daily, networkTrendData: trend, donutChartData: donut, chartDataBar: bar };
  }, [dataHotspot]);

  const totalUsers = chartDataBar.length;
  const totalDataUsageMB = chartDataBar.reduce((s, i) => s + i.totalMB, 0);
  const avgDataUsageMB = totalUsers > 0 ? totalDataUsageMB / totalUsers : 0;
  const routerTotalGB = totalDataUsageMB / 1024;

  // ===== Ringkasan turunan (hanya untuk keperluan tampilan/label) =====
  const uniqueUsers = useMemo(() => new Set(aiDailyData.map(r => r.Username)).size, [aiDailyData]);
  const totalDailyMB = useMemo(() => aiDailyData.reduce((s, i) => s + i.DailyMB, 0), [aiDailyData]);
  const activeDays = networkTrendData.length;
  const avgDailyMB = activeDays > 0 ? totalDailyMB / activeDays : 0;
  const peakDay = networkTrendData.reduce((max, i) => (!max || i.PemakaianHarian > max.PemakaianHarian ? i : max), null);
  const donutTotalMB = donutChartData.reduce((s, i) => s + i.value, 0) || 1;
  const topRooms = chartDataBar.slice(0, 10);

  const filteredDaily = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? aiDailyData.filter(r => r.Username.toLowerCase().includes(q)) : aiDailyData;
  }, [aiDailyData, search]);

  // ================= FUP =================
  const fupWithStats = fupList.map(item => {
    const used = item.isAutoSync ? item.manualUsedGB + routerTotalGB : item.manualUsedGB;
    const pct = item.limitGB > 0 ? Math.min((used / item.limitGB) * 100, 100) : 0;
    return { ...item, used, pct };
  });
  const worstPct = fupWithStats.reduce((m, i) => Math.max(m, i.pct), 0);
  const ispStatus = fupWithStats.length === 0
    ? { label: 'Belum diatur', dot: 'bg-slate-400' }
    : worstPct >= 90 ? { label: 'Kritis', dot: 'bg-red-500' }
    : worstPct >= 75 ? { label: 'Waspada', dot: 'bg-amber-500' }
    : { label: 'Normal', dot: 'bg-emerald-500' };

  const handleSaveFup = async (e) => {
    e.preventDefault();
    const clean = {
      id: fupForm.id,
      isp: fupForm.isp.trim(),
      packageName: (fupForm.packageName || '').trim(),
      limitGB: Number(fupForm.limitGB) || 0,
      manualUsedGB: Math.max(0, Number(fupForm.manualUsedGB) || 0),
      isAutoSync: Boolean(fupForm.isAutoSync),
      periodStart: fupForm.periodStart || '',
      periodEnd: fupForm.periodEnd || '',
      notes: (fupForm.notes || '').trim()
    };
    if (clean.limitGB <= 0) { setFupError('Limit FUP harus lebih besar dari 0.'); return; }
    if (clean.periodStart && clean.periodEnd && clean.periodStart > clean.periodEnd) {
      setFupError('Periode mulai tidak boleh melewati periode selesai.');
      return;
    }
    setFupSaving(true);
    setFupError('');
    try {
      if (isEditingFup) {
        const res = await fupSend({ action: 'update', id: clean.id, data: clean });
        setFupList(list => list.map(i => i.id === clean.id ? res.data : i));
      } else {
        const { id, ...payload } = clean;
        const res = await fupSend({ action: 'create', data: payload });
        setFupList(list => [...list, res.data]);
      }
      setFupForm(EMPTY_FUP);
      setIsEditingFup(false);
    } catch (err) {
      setFupError(apiError(err));
    } finally {
      setFupSaving(false);
    }
  };
  const handleEditFup = (item) => {
    setFupForm({ ...EMPTY_FUP, ...item });
    setIsEditingFup(true);
    setFupError('');
  };
  const handleDeleteFup = async (id) => {
    if (!window.confirm('Hapus data ISP ini?')) return;
    setFupSaving(true);
    setFupError('');
    try {
      await fupSend({ action: 'delete', id });
      setFupList(list => list.filter(i => i.id !== id));
      if (fupForm.id === id) { setFupForm(EMPTY_FUP); setIsEditingFup(false); }
    } catch (err) {
      setFupError(apiError(err));
    } finally {
      setFupSaving(false);
    }
  };
  const cancelEdit = () => { setFupForm(EMPTY_FUP); setIsEditingFup(false); setFupError(''); };

  // ================= TAMPILAN LOGIN =================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden print:hidden">
        <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" aria-hidden="true"></div>
        <div className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden="true"></div>

        <div className="relative max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-7 sm:p-10 border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-start mb-7">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/25"><Lock size={26} /></div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight leading-none">Smart Kost 50</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1.5 tracking-wide uppercase">Administrator Executive Panel</p>
              </div>
            </div>
            <button type="button" aria-label="Ganti tema" onClick={() => setDarkMode(!darkMode)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {loginError && (
            <div role="alert" className="mb-6 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/50 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">Username</label>
              <input id="username" type="text" autoComplete="username" required placeholder="Masukkan username" value={loginInput.username} onChange={(e) => setLoginInput({ ...loginInput, username: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-white text-sm transition" />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">Password</label>
              <input id="password" type="password" autoComplete="current-password" required placeholder="Masukkan password" value={loginInput.password} onChange={(e) => setLoginInput({ ...loginInput, password: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-white text-sm transition" />
            </div>
            <button type="submit" disabled={isLoggingIn || lockRemaining > 0} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-sm">
              {isLoggingIn ? <Activity className="animate-spin" size={18} /> : lockRemaining > 0 ? <Lock size={16} /> : <LogOut size={16} className="rotate-180" />}
              {isLoggingIn ? 'Memverifikasi...' : lockRemaining > 0 ? `Terkunci - coba lagi ${lockRemaining} detik` : 'Login Dashboard'}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-center text-slate-400 dark:text-slate-500 leading-relaxed">
            Akses terbatas untuk administrator. Percobaan gagal maksimal {MAX_ATTEMPTS} kali sebelum terkunci {LOCK_SECONDS} detik.
          </p>
        </div>
      </div>
    );
  }

  // ================= TAMPILAN DASHBOARD =================
  const navItem = (id, Icon, label, activeCls) => (
    <button onClick={() => { setActiveTab(id); setIsMobileOpen(false); }}
      aria-current={activeTab === id ? 'page' : undefined}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all border-l-4 ${activeTab === id ? `${activeCls} border-current shadow-sm` : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'}`}>
      <Icon size={18} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
  const gridStroke = darkMode ? '#334155' : '#f1f5f9';
  const axisTick = { fill: '#64748b', fontSize: 11 };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300 print:bg-white print:text-black">

      {isMobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden print:hidden" onClick={() => setIsMobileOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-64 xl:w-72 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} print:hidden`}>
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center min-w-0">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-xl text-white mr-3 shadow-lg shadow-blue-600/25 shrink-0"><Wifi size={20} /></div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight leading-none truncate">KOST 50</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-1">Network Console</p>
            </div>
          </div>
          <button aria-label="Tutup menu" className="md:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1" onClick={() => setIsMobileOpen(false)}><X size={22} /></button>
        </div>

        <div className="p-3 overflow-y-auto flex-1">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2.5 px-2 uppercase tracking-widest">Executive Menu</p>
          <nav className="space-y-1.5">
            {navItem('dashboard', BarChart2, 'Visualisasi Data', 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300')}
            {navItem('ai-analysis', Bot, 'Laporan AI & Tabel', 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300')}
            {navItem('fup-monitor', Server, 'Sistem FUP ISP', 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300')}
            {navItem('rekap', Activity, 'Log Server Mentah', 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white')}
          </nav>

          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Status Sumber Data</p>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : fetchError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>Sheet Hotspot</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">{dataHotspot.length} baris</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${fupLoading ? 'bg-amber-500 animate-pulse' : fupError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>Sheet FUP ISP</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">{fupList.length} ISP</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 px-2 pb-2.5">
            <div className="h-9 w-9 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md shrink-0">
              {currentUser.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{currentUser}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Administrator</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 px-3.5 py-2.5 w-full rounded-xl transition-colors font-semibold text-sm">
            <LogOut size={18} /><span>Logout Secure</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0 print:h-auto print:overflow-visible">

        {needsRecap && (
          <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-2.5 flex items-center justify-center gap-2.5 shadow-md z-20 print:hidden text-xs sm:text-sm text-center">
            <AlertTriangle size={18} className="shrink-0" />
            <span className="font-semibold tracking-wide">Hari ini tgl {todayDate}. Export laporan sebelum reset tanggal 1.</span>
          </div>
        )}

        <header className="h-auto md:h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-3 md:py-0 flex justify-between items-center gap-3 shrink-0 print:hidden transition-colors duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <button aria-label="Buka menu" className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setIsMobileOpen(true)}><Menu size={22} /></button>
            <div className="min-w-0">
              <h2 className="text-lg md:text-2xl font-extrabold text-slate-800 dark:text-white truncate leading-tight">{TAB_TITLES[activeTab]}</h2>
              <p className="hidden sm:block text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{TAB_SUBTITLES[activeTab]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden lg:inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <span className={`h-2 w-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : fetchError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
              {loading ? 'Memuat...' : fetchError ? 'Gagal memuat' : `${dataHotspot.length} record`}
            </span>
            <button aria-label="Muat ulang data" title="Muat ulang data" onClick={() => setReloadKey(k => k + 1)} disabled={loading} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 text-slate-600 dark:text-slate-300">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button aria-label="Ganti tema" onClick={() => setDarkMode(!darkMode)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div title={currentUser} className="hidden sm:flex h-10 pl-1 pr-3 items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
              <span className="h-8 w-8 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                {currentUser.charAt(0).toUpperCase()}
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 max-w-[90px] truncate">{currentUser}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 mx-auto w-full max-w-[1500px] print:p-0 print:overflow-visible">
          {loading && dataHotspot.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-slate-400 gap-1">
              <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center mb-3">
                <Activity className="animate-spin text-blue-500" size={26} />
              </div>
              <p className="font-bold text-slate-600 dark:text-slate-200">Memuat analitik jaringan...</p>
              <p className="text-xs text-slate-400">Mengambil data dari Google Sheets</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col justify-center items-center h-full text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-950/60 flex items-center justify-center">
                <AlertTriangle className="text-red-500" size={26} />
              </div>
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-200">Data gagal dimuat</p>
                <p className="font-medium text-slate-500 dark:text-slate-400 max-w-sm text-sm mt-1">{fetchError}</p>
              </div>
              <button onClick={() => setReloadKey(k => k + 1)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
                <RefreshCw size={16} /> Coba lagi
              </button>
            </div>
          ) : (
            <>
              {/* ================= DASHBOARD ================= */}
              {activeTab === 'dashboard' && (
                <div className="space-y-4 md:space-y-6 print:hidden">
                  {/* ===== KARTU RINGKASAN ===== */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5">
                    {[
                      { label: 'Kamar Aktif', value: totalUsers, sub: `${uniqueUsers} username unik Â· ${dataHotspot.length} record log`, Icon: Users, cls: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400', bar: 'bg-blue-500' },
                      { label: 'Trafik Kumulatif', value: formatDataSize(totalDataUsageMB), sub: `â‰ˆ ${routerTotalGB.toFixed(2)} GB tercatat bulan ini`, Icon: TrendingUp, cls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
                      { label: 'Rata-rata / Kamar', value: formatDataSize(avgDataUsageMB), sub: `Total harian ${formatDataSize(totalDailyMB)}`, Icon: Activity, cls: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
                      { label: 'Status ISP', value: ispStatus.label, sub: `${fupWithStats.length} ISP dipantau Â· pemakaian terburuk ${worstPct.toFixed(0)}%`, Icon: Server, cls: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-500', status: true }
                    ].map(k => (
                      <div key={k.label} className={`${card} p-4 sm:p-5 relative overflow-hidden hover:shadow-md transition-shadow`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{k.label}</p>
                            <h3 className={`mt-2 text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2`}>
                              {k.status && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ispStatus.dot} ${worstPct > 0 ? 'animate-pulse' : ''}`}></span>}
                              <span className="truncate">{k.value}</span>
                            </h3>
                            <p className="mt-1.5 text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 leading-snug">{k.sub}</p>
                          </div>
                          <div className={`${k.cls} p-2 rounded-xl shrink-0`}><k.Icon size={18} /></div>
                        </div>
                        <span className={`absolute left-0 bottom-0 h-1 w-full ${k.bar} opacity-70`}></span>
                      </div>
                    ))}
                  </div>

                  {dataHotspot.length === 0 ? (
                    <EmptyState Icon={BarChart2} title="Belum ada data hotspot untuk ditampilkan." hint="Tekan tombol muat ulang di header setelah sheet terisi." />
                  ) : (
                    <>
                      {/* ===== BARIS 1: AREA + DONUT ===== */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                        <div className={`${card} p-4 sm:p-6 lg:col-span-2 min-w-0`}>
                          <SectionHeader
                            Icon={TrendingUp} iconCls="text-violet-500"
                            title="Pertumbuhan Volume Kumulatif"
                            subtitle="Total akumulasi penggunaan seluruh kamar sejak awal periode"
                            right={<Pill tone="indigo">{activeDays} hari tercatat</Pill>}
                          />
                          <div className="h-56 sm:h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={networkTrendData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorKumulatif" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                <XAxis dataKey="Tanggal" axisLine={false} tickLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={28} />
                                <YAxis width={64} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatDataSize} />
                                <RechartsTooltip formatter={(v, n) => [formatDataSize(v), n]} labelFormatter={(l) => `Tanggal ${l}`} contentStyle={tooltipStyle(darkMode)} cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Area type="monotone" dataKey="TotalKumulatif" name="Kumulatif" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorKumulatif)" dot={false} activeDot={{ r: 5 }} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Total: <b className="text-slate-700 dark:text-slate-200">{formatDataSize(totalDataUsageMB)}</b></span>
                            <span>Rata-rata/kamar: <b className="text-slate-700 dark:text-slate-200">{formatDataSize(avgDataUsageMB)}</b></span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500"></span>Kumulatif semua kamar</span>
                          </div>
                        </div>

                        <div className={`${card} p-4 sm:p-6 min-w-0`}>
                          <SectionHeader
                            Icon={PieChartIcon} iconCls="text-emerald-500"
                            title="Distribusi Beban"
                            subtitle="Proporsi pemakaian tiap kamar terhadap total"
                            right={<Pill tone="emerald">{donutChartData.length} segmen</Pill>}
                          />
                          <div className="relative h-44 sm:h-52 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={donutChartData} cx="50%" cy="50%" innerRadius={56} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                                  {donutChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip formatter={(v, n) => [formatDataSize(v), n]} contentStyle={tooltipStyle(darkMode)} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</span>
                              <span className="text-sm font-extrabold text-slate-800 dark:text-white">{formatDataSize(totalDataUsageMB)}</span>
                            </div>
                          </div>
                          <ul className="mt-4 space-y-1.5">
                            {donutChartData.map((d, i) => (
                              <li key={d.name} className="flex items-center gap-2 text-xs">
                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                <span className="truncate flex-1 text-slate-600 dark:text-slate-300" title={d.name}>{d.name}</span>
                                <span className="tabular-nums text-slate-400 font-semibold w-10 text-right">{formatPct((d.value / donutTotalMB) * 100)}</span>
                                <span className="tabular-nums font-bold text-slate-700 dark:text-slate-200 w-20 text-right">{formatDataSize(d.value)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* ===== BARIS 2: LEADERBOARD + TREN HARIAN ===== */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        <div className={`${card} p-4 sm:p-6 min-w-0`}>
                          <SectionHeader
                            Icon={BarChart2} iconCls="text-blue-500"
                            title="Leaderboard Kamar"
                            subtitle="Peringkat konsumsi data kumulatif per kamar"
                            right={<Pill tone="blue">Top {topRooms.length} dari {totalUsers}</Pill>}
                          />
                          <div className="w-full" style={{ height: Math.max(240, topRooms.length * 34 + 24) }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={topRooms} layout="vertical" margin={{ top: 4, right: 66, left: 4, bottom: 0 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={gridStroke} />
                                <XAxis type="number" tickFormatter={formatDataSize} tick={axisTick} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" width={96} tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                                <RechartsTooltip cursor={{ fill: darkMode ? '#1e293b22' : '#f1f5f9' }} formatter={(v, n) => [formatDataSize(v), n]} labelFormatter={(l) => `Kamar ${l}`} contentStyle={tooltipStyle(darkMode)} />
                                <Bar dataKey="totalMB" name="Total Data" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={16} background={{ fill: darkMode ? '#1e293b' : '#f1f5f9', radius: [0, 6, 6, 0] }}>
                                  <LabelList content={BarValueLabel} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          {chartDataBar.length > 10 && (
                            <p className="mt-3 text-[11px] text-slate-400">Menampilkan 10 teratas dari {chartDataBar.length} kamar. Lihat tab Laporan untuk data lengkap.</p>
                          )}
                        </div>

                        <div className={`${card} p-4 sm:p-6 min-w-0`}>
                          <SectionHeader
                            Icon={Activity} iconCls="text-rose-500"
                            title="Tren Fluktuasi Harian"
                            subtitle="Total data yang dikonsumsi seluruh kamar per hari"
                            right={peakDay ? <Pill tone="red">Puncak {peakDay.Tanggal}: {formatDataSize(peakDay.PemakaianHarian)}</Pill> : null}
                          />
                          <div className="h-56 sm:h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={networkTrendData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                <XAxis dataKey="Tanggal" axisLine={false} tickLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={28} />
                                <YAxis width={64} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatDataSize} />
                                <RechartsTooltip formatter={(v, n) => [formatDataSize(v), n]} labelFormatter={(l) => `Tanggal ${l}`} contentStyle={tooltipStyle(darkMode)} cursor={{ stroke: '#f43f5e', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Line type="monotone" dataKey="PemakaianHarian" name="Pemakaian/Hari" stroke="#f43f5e" strokeWidth={3}
                                  dot={networkTrendData.length <= 15 ? { r: 3, strokeWidth: 2, fill: darkMode ? '#0f172a' : '#fff' } : false}
                                  activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Rata-rata/hari: <b className="text-slate-700 dark:text-slate-200">{formatDataSize(avgDailyMB)}</b></span>
                            <span>Hari tercatat: <b className="text-slate-700 dark:text-slate-200">{activeDays}</b></span>
                            <span>Total: <b className="text-slate-700 dark:text-slate-200">{formatDataSize(totalDailyMB)}</b></span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ================= LAPORAN AI & TABEL ================= */}
              {activeTab === 'ai-analysis' && (
                <div className="space-y-4 md:space-y-6">
                  <div className="hidden print:block mb-8 text-center border-b-2 border-slate-800 pb-6 text-black">
                    <h1 className="text-3xl font-extrabold uppercase tracking-wider mb-2">Laporan Rekapitulasi Jaringan</h1>
                    <h2 className="text-xl font-bold uppercase">Management KOST 50</h2>
                    <p className="text-sm mt-2">Dicetak pada: {new Date().toLocaleDateString('id-ID')}</p>
                  </div>

                  <div className="mb-0 flex flex-col lg:flex-row lg:items-end justify-between gap-4 print:hidden">
                    <div className="min-w-0">
                      <h3 className="text-xl md:text-2xl font-extrabold flex items-center gap-2"><Bot className="text-indigo-500 shrink-0" size={22} /> Analisis AI Harian</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{TAB_SUBTITLES['ai-analysis']}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="search" aria-label="Cari username" placeholder="Cari username..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9 w-full sm:w-56`} />
                      </div>
                      <button onClick={() => downloadCSV(filteredDaily.map(({ ts, ...r }) => r), 'Harian_Kost50.csv')} disabled={filteredDaily.length === 0} className="justify-center flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">
                        <Download size={16} /> Export CSV
                      </button>
                      <button onClick={() => window.print()} className="justify-center flex items-center gap-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">
                        <Printer size={16} /> Cetak PDF
                      </button>
                    </div>
                  </div>

                  {/* ===== RINGKASAN TABEL ===== */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
                    {[
                      { label: 'Baris Ditampilkan', value: filteredDaily.length, hint: `dari ${aiDailyData.length} total baris`, tone: 'text-indigo-600 dark:text-indigo-400' },
                      { label: 'Username Unik', value: new Set(filteredDaily.map(r => r.Username)).size, hint: 'kamar pada hasil filter', tone: 'text-blue-600 dark:text-blue-400' },
                      { label: 'Total Hari Ini', value: formatDataSize(filteredDaily.reduce((s, r) => s + r.DailyMB, 0)), hint: 'akumulasi kolom harian', tone: 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Rata-rata / Baris', value: formatDataSize(filteredDaily.length ? filteredDaily.reduce((s, r) => s + r.DailyMB, 0) / filteredDaily.length : 0), hint: 'pemakaian per record', tone: 'text-amber-600 dark:text-amber-400' }
                    ].map(s => (
                      <div key={s.label} className={`${card} p-4`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                        <p className={`mt-1.5 text-lg sm:text-xl font-extrabold tabular-nums ${s.tone}`}>{s.value}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.hint}</p>
                      </div>
                    ))}
                  </div>

                  <div className={`${card} overflow-hidden print:shadow-none print:border-none print:rounded-none`}>
                    <div className="px-4 md:px-6 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40 print:hidden">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Menampilkan <b className="text-slate-700 dark:text-slate-200">{filteredDaily.length}</b> dari {aiDailyData.length} baris
                      </p>
                      <div className="flex items-center gap-2">
                        <Pill tone="indigo">Baseline = pemakaian awal</Pill>
                        <Pill tone="slate">Urut terbaru</Pill>
                      </div>
                    </div>
                    <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="sticky top-0 z-10 print:static">
                          <tr className="bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-slate-700 text-[11px] uppercase tracking-wider print:bg-slate-100 print:text-black">
                            <th className="py-3.5 px-4 md:px-6 font-bold text-slate-600 dark:text-slate-300 bg-indigo-50 dark:bg-indigo-950/60 print:bg-slate-100 print:text-black">Tanggal</th>
                            <th className="py-3.5 px-4 md:px-6 font-bold text-slate-600 dark:text-slate-300 bg-indigo-50 dark:bg-indigo-950/60 print:bg-slate-100 print:text-black">Username</th>
                            <th className="py-3.5 px-4 md:px-6 font-bold text-right text-slate-600 dark:text-slate-300 bg-indigo-50 dark:bg-indigo-950/60 print:bg-slate-100 print:text-black" title="Selisih pemakaian dibanding record sebelumnya">Hari Ini</th>
                            <th className="py-3.5 px-4 md:px-6 font-bold text-right text-slate-600 dark:text-slate-300 bg-indigo-50 dark:bg-indigo-950/60 print:bg-slate-100 print:text-black" title="Akumulasi total pemakaian user">Kumulatif</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDaily.length === 0 ? (
                            <tr><td colSpan={4} className="py-12 text-center text-slate-500">Tidak ada data yang cocok dengan pencarian.</td></tr>
                          ) : filteredDaily.map((row, i) => (
                            <tr key={`${row.Username}-${row.Tanggal}-${i}`} className="border-b border-slate-100 dark:border-slate-700/70 odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/20 hover:bg-indigo-50/60 dark:hover:bg-slate-700/40 transition-colors print:bg-white print:border-slate-300">
                              <td className="py-3 px-4 md:px-6 text-sm text-slate-600 dark:text-slate-400 print:text-black tabular-nums">{row.Tanggal}</td>
                              <td className="py-3 px-4 md:px-6 font-bold print:text-black">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center uppercase print:hidden">{row.Username.charAt(0)}</span>
                                  {row.Username}
                                </span>
                              </td>
                              <td className="py-3 px-4 md:px-6 text-right">
                                {row.IsBaseline ? (
                                  <span className="text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-1 rounded-md print:border print:border-slate-400">Baseline</span>
                                ) : (
                                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full tabular-nums print:bg-transparent print:text-black">
                                    + {formatDataSize(row.DailyMB)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 md:px-6 text-right font-semibold text-slate-600 dark:text-slate-300 print:text-black tabular-nums">{formatDataSize(row.CumulativeMB)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {filteredDaily.length > 0 && (
                          <tfoot className="sticky bottom-0 print:static">
                            <tr className="border-t-2 border-slate-200 dark:border-slate-700 text-xs">
                              <td className="py-3 px-4 md:px-6 font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 print:bg-slate-100 print:text-black" colSpan={2}>Total ({filteredDaily.length} baris)</td>
                              <td className="py-3 px-4 md:px-6 text-right font-extrabold text-indigo-700 dark:text-indigo-300 tabular-nums bg-slate-100 dark:bg-slate-800 print:bg-slate-100 print:text-black">
                                {formatDataSize(filteredDaily.reduce((s, r) => s + r.DailyMB, 0))}
                              </td>
                              <td className="py-3 px-4 md:px-6 text-right font-extrabold text-slate-700 dark:text-slate-200 tabular-nums bg-slate-100 dark:bg-slate-800 print:bg-slate-100 print:text-black">
                                {formatDataSize(filteredDaily.reduce((s, r) => s + r.CumulativeMB, 0))}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= FUP ISP ================= */}
              {activeTab === 'fup-monitor' && (
                <div className="space-y-4 md:space-y-6 print:hidden">
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-xl md:text-2xl font-extrabold flex items-center gap-2"><Server className="text-emerald-500 shrink-0" size={22} /> Monitoring FUP ISP</h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                        {TAB_SUBTITLES['fup-monitor']}. Auto-Sync menambahkan total pemakaian hotspot ke hitungan tiap ISP. Data tersinkron dengan Google Sheets (sheet FUP).
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Pill tone="slate">{fupWithStats.length} ISP terpantau</Pill>
                      <Pill tone={worstPct >= 90 ? 'red' : worstPct >= 75 ? 'amber' : 'emerald'}>Status: {ispStatus.label}</Pill>
                      <Pill tone="indigo">Hotspot +{routerTotalGB.toFixed(2)} GB</Pill>
                    </div>
                  </div>

                  {fupError && (
                    <div role="alert" className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3.5 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/50 flex items-center gap-2">
                      <AlertTriangle size={16} className="shrink-0" /> <span className="flex-1">{fupError}</span>
                      <button type="button" aria-label="Tutup pesan" onClick={() => setFupError('')}><X size={16} /></button>
                    </div>
                  )}

                  {fupLoading ? (
                    <div className={`${card} p-10 text-center text-slate-500 flex items-center justify-center gap-3`}>
                      <Activity className="animate-spin text-emerald-500" size={20} /> Memuat data FUP dari Google Sheets...
                    </div>
                  ) : fupWithStats.length === 0 ? (
                    <EmptyState Icon={Server} title="Belum ada ISP." hint="Tambahkan ISP pertama lewat formulir di bawah." />
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                      {fupWithStats.map(item => {
                        const pctValue = item.pct;
                        const barColor = pctValue > 90 ? 'bg-red-500' : pctValue > 75 ? 'bg-amber-500' : 'bg-emerald-500';
                        const textColor = pctValue > 90 ? '#ef4444' : pctValue > 75 ? '#f59e0b' : '#10b981';
                        const tone = pctValue >= 90 ? 'red' : pctValue >= 75 ? 'amber' : 'emerald';
                        const statusLabel = pctValue >= 90 ? 'Kritis' : pctValue >= 75 ? 'Waspada' : 'Normal';
                        const remainingGB = Math.max(0, item.limitGB - item.used);
                        const daysLeft = item.periodEnd ? Math.max(0, Math.ceil((parseTanggal(item.periodEnd) - now) / 86400000)) : null;
                        return (
                          <div key={item.id} className={`${card} p-4 sm:p-6 relative overflow-hidden`}>
                            {pctValue >= 95 && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl tracking-wider">CRITICAL</div>}
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-base sm:text-lg font-bold truncate">{item.isp}</h4>
                                  <Pill tone={tone}>{statusLabel}</Pill>
                                </div>
                                {item.packageName && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.packageName}</p>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button aria-label={`Edit ${item.isp}`} onClick={() => handleEditFup(item)} disabled={fupSaving} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"><Edit size={16} /></button>
                                <button aria-label={`Hapus ${item.isp}`} onClick={() => handleDeleteFup(item.id)} disabled={fupSaving} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"><Trash2 size={16} /></button>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-4">
                              {[
                                { l: 'Terpakai', v: `${item.used.toFixed(2)} GB`, c: 'text-slate-800 dark:text-white' },
                                { l: 'Sisa Kuota', v: `${remainingGB.toFixed(2)} GB`, c: tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' },
                                { l: 'Batas FUP', v: `${item.limitGB} GB`, c: 'text-slate-800 dark:text-white' }
                              ].map(x => (
                                <div key={x.l} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 py-2.5 px-2 text-center">
                                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">{x.l}</p>
                                  <p className={`text-xs sm:text-sm font-extrabold tabular-nums mt-1 ${x.c}`}>{x.v}</p>
                                </div>
                              ))}
                            </div>

                            <div className="relative w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3.5 overflow-hidden">
                              <div className={`${barColor} h-full rounded-full transition-all duration-700`} style={{ width: `${Math.min(pctValue, 100)}%` }}></div>
                              <span className="absolute inset-y-0 w-px bg-slate-400/70 dark:bg-slate-500" style={{ left: '75%' }} title="Batas waspada 75%"></span>
                              <span className="absolute inset-y-0 w-px bg-slate-400/70 dark:bg-slate-500" style={{ left: '90%' }} title="Batas kritis 90%"></span>
                            </div>
                            <div className="flex justify-between items-center gap-2 mt-2 text-[10px] font-semibold text-slate-400">
                              <span>0%</span>
                              <span className="hidden sm:inline">75% waspada</span>
                              <span className="hidden sm:inline">90% kritis</span>
                              <span className="font-extrabold text-xs tabular-nums" style={{ color: textColor }}>{formatPct(pctValue)} penuh</span>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2.5 text-xs text-slate-500 dark:text-slate-400">
                              {(item.periodStart || item.periodEnd) && (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="tabular-nums">Periode: {item.periodStart || '?'} s/d {item.periodEnd || '?'}</span>
                                  {daysLeft !== null && (
                                    <Pill tone={daysLeft <= 3 ? 'red' : 'slate'}>{daysLeft > 0 ? `Sisa ${daysLeft} hari` : 'Berakhir hari ini'}</Pill>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                {item.isAutoSync
                                  ? <Pill tone="indigo">Auto-Sync + {routerTotalGB.toFixed(2)} GB dari Hotspot</Pill>
                                  : <Pill tone="slate">Input Manual</Pill>}
                              </div>
                              {item.notes && <p className="bg-slate-50 dark:bg-slate-800/70 rounded-lg p-2.5 leading-relaxed">{item.notes}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className={`${card} overflow-hidden`}>
                    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                        <div>
                          <h4 className="font-bold text-base sm:text-lg flex items-center gap-2">
                            {isEditingFup ? <><Edit size={16} className="text-blue-500" /> Edit Data ISP</> : <><Plus size={16} className="text-emerald-500" /> Tambah ISP Baru</>}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Semua kolom bertanda * wajib diisi. Limit FUP dalam satuan GB.</p>
                        </div>
                        {isEditingFup && <Pill tone="blue">Mode Edit</Pill>}
                      </div>
                      <form onSubmit={handleSaveFup} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                          <Field label="Nama ISP *" hint="Contoh: Indihome, MyRepublic">
                            <input type="text" placeholder="Nama ISP" required value={fupForm.isp} onChange={e => setFupForm({ ...fupForm, isp: e.target.value })} className={inputCls} />
                          </Field>
                          <Field label="Paket" hint="Contoh: 100 Mbps Unlimited">
                            <input type="text" placeholder="Paket (mis. 100 Mbps)" value={fupForm.packageName} onChange={e => setFupForm({ ...fupForm, packageName: e.target.value })} className={inputCls} />
                          </Field>
                          <Field label="Limit FUP (GB) *" hint="Angka > 0">
                            <input type="number" min="1" step="any" placeholder="Limit FUP (GB)" required value={fupForm.limitGB} onChange={e => setFupForm({ ...fupForm, limitGB: e.target.value })} className={inputCls} />
                          </Field>
                          <Field label="Pemakaian Eksternal (GB)" hint="Pemakaian di luar hotspot">
                            <input type="number" min="0" step="any" placeholder="Pemakaian Eksternal (GB)" value={fupForm.manualUsedGB} onChange={e => setFupForm({ ...fupForm, manualUsedGB: e.target.value })} className={inputCls} />
                          </Field>
                          <Field label="Periode Mulai">
                            <input type="date" value={fupForm.periodStart} onChange={e => setFupForm({ ...fupForm, periodStart: e.target.value })} className={inputCls} />
                          </Field>
                          <Field label="Periode Selesai">
                            <input type="date" value={fupForm.periodEnd} onChange={e => setFupForm({ ...fupForm, periodEnd: e.target.value })} className={inputCls} />
                          </Field>
                          <div className="sm:col-span-2">
                            <Field label="Catatan (opsional)">
                              <input type="text" placeholder="Catatan (opsional)" value={fupForm.notes} onChange={e => setFupForm({ ...fupForm, notes: e.target.value })} className={inputCls} />
                            </Field>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <label className="flex items-start gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer w-fit bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5">
                            <input type="checkbox" checked={fupForm.isAutoSync} onChange={e => setFupForm({ ...fupForm, isAutoSync: e.target.checked })} className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span>
                              Sinkronkan dengan total data hotspot
                              <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Pemakaian akan ditambah {routerTotalGB.toFixed(2)} GB dari router</span>
                            </span>
                          </label>
                          <div className="flex gap-2">
                            {isEditingFup && (
                              <button type="button" onClick={cancelEdit} disabled={fupSaving} className="px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">Batal</button>
                            )}
                            <button type="submit" disabled={fupSaving} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
                              {fupSaving ? <Activity size={16} className="animate-spin" /> : isEditingFup ? <Save size={16} /> : <Plus size={16} />}
                              {fupSaving ? 'Menyimpan...' : isEditingFup ? 'Simpan Perubahan' : 'Tambah ISP'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= LOG MENTAH ================= */}
              {activeTab === 'rekap' && (
                <div className={`${card} overflow-hidden print:hidden`}>
                  <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-700 flex flex-wrap justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-800/50 gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold flex items-center gap-2"><Activity size={18} className="text-slate-400 shrink-0" /> Database Server Mentah</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{TAB_SUBTITLES['rekap']}</p>
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        <Pill tone="blue">{dataHotspot.length} baris</Pill>
                        <Pill tone="slate">{new Set(dataHotspot.map(r => r.Username)).size} username</Pill>
                        <Pill tone="emerald">{formatDataSize(totalDataUsageMB)} kumulatif</Pill>
                      </div>
                    </div>
                    <button onClick={() => downloadCSV(dataHotspot, 'Raw_Database_Kost50.csv')} disabled={dataHotspot.length === 0} className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                      <Download size={16} /> Export Raw
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-400 text-[11px] uppercase tracking-wider">
                          <th className="py-3.5 px-4 md:px-6 font-bold bg-white dark:bg-slate-900">Tanggal</th>
                          <th className="py-3.5 px-4 md:px-6 font-bold bg-white dark:bg-slate-900">Username</th>
                          <th className="py-3.5 px-4 md:px-6 font-bold text-right bg-white dark:bg-slate-900" title="Total kumulatif pemakaian per record">Total Pemakaian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataHotspot.length === 0 ? (
                          <tr><td colSpan={3} className="py-12 text-center text-slate-500">Tidak ada data.</td></tr>
                        ) : dataHotspot.map((row, i) => (
                          <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/20 hover:bg-emerald-50/60 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="py-3 px-4 md:px-6 text-slate-500 dark:text-slate-400 text-sm tabular-nums">{row.Tanggal}</td>
                            <td className="py-3 px-4 md:px-6 font-bold">{row.Username}</td>
                            <td className="py-3 px-4 md:px-6 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatDataSize(row['Total (MB)'])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
