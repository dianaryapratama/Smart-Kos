import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cpu, MemoryStick, HardDrive, Thermometer, Zap, Clock, Activity, ArrowDown, ArrowUp,
  Network, Router, Wifi, Server, ScrollText, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, ArrowDownUp, Gauge, ListChecks, Signal, Globe, Cable, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip
} from 'recharts';
import { fetchRouterStats } from './routerApi';
import { fetchSheetRows } from './dataSource';
import { STATS_POLL_MS, SHEET_REFRESH_MS } from './config';

const card = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm';

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const PERIODS = [
  { id: 'daily', label: 'Harian' },
  { id: 'weekly', label: 'Mingguan' },
  { id: 'monthly', label: 'Bulanan' },
  { id: 'yearly', label: 'Tahunan' }
];

// ---------- util format ----------
function formatRate(bytesPerSec) {
  const n = Number(bytesPerSec) || 0;
  const bits = n * 8;
  if (bits >= 1e6) return `${(bits / 1e6).toFixed(2)} Mbps`;
  if (bits >= 1e3) return `${(bits / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bits)} bps`;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : v < 10 ? 2 : 1)} ${units[i]}`;
}

function safePct(used, total) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

function toneFor(pct) {
  if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
  if (pct >= 75) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
}

// ---------- util tanggal / agregasi (dari spreadsheet) ----------
function parseTanggal(value) {
  if (!value) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  const iso = Date.parse(s);
  return Number.isNaN(iso) ? null : iso;
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function keyToTs(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d || 1).getTime();
}

function weekKey(ts) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Senin = 0
  d.setDate(d.getDate() - day);
  return dayKey(d.getTime());
}

function labelFor(key, period) {
  const parts = key.split('-');
  if (period === 'yearly') return key;
  if (period === 'monthly') return `${MONTHS_ID[Number(parts[1]) - 1]} ${parts[0]}`;
  const d = parts[2] || '01';
  return period === 'weekly' ? `Pk ${d}/${parts[1]}` : `${d}/${parts[1]}`;
}

// Hitung pemakaian harian (MB) per tanggal dari baris hotspot (selisih kumulatif per user)
function computeDailyMB(rows) {
  const byUser = new Map();
  for (const row of rows) {
    const user = row.Username;
    const ts = parseTanggal(row.Tanggal);
    if (!user || ts == null) continue;
    const total = parseFloat(String(row['Total (MB)'] ?? '').replace(',', '.'));
    if (!byUser.has(user)) byUser.set(user, []);
    byUser.get(user).push({ ts, total: Number.isNaN(total) ? 0 : total });
  }
  const perDay = new Map();
  for (const recs of byUser.values()) {
    recs.sort((a, b) => a.ts - b.ts);
    let prev = null;
    for (const rec of recs) {
      let pure = prev == null ? 0 : rec.total - prev;
      if (pure < 0) pure = rec.total;
      const key = dayKey(rec.ts);
      perDay.set(key, (perDay.get(key) || 0) + pure);
      prev = rec.total;
    }
  }
  return [...perDay.entries()].map(([key, mb]) => ({ key, mb }));
}

function aggregate(perDay, period) {
  if (!perDay.length) return [];
  const buckets = new Map();
  const order = [];
  for (const { key, mb } of [...perDay].sort((a, b) => (a.key < b.key ? -1 : 1))) {
    const ts = keyToTs(key);
    let bucket = key;
    if (period === 'weekly') bucket = weekKey(ts);
    else if (period === 'monthly') bucket = key.slice(0, 7);
    else if (period === 'yearly') bucket = key.slice(0, 4);
    if (!buckets.has(bucket)) order.push(bucket);
    buckets.set(bucket, (buckets.get(bucket) || 0) + mb);
  }
  let data = order.map((k) => ({ key: k, label: labelFor(k, period), mb: buckets.get(k) }));
  if (period === 'daily') data = data.slice(-30);
  else if (period === 'weekly') data = data.slice(-16);
  else if (period === 'monthly') data = data.slice(-12);
  return data;
}

// ---------- komponen kecil ----------
const SectionTitle = ({ Icon, title, subtitle, right }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
    <div className="min-w-0">
      <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-800 dark:text-white">
        {Icon && <Icon size={17} className="text-emerald-500 shrink-0" />} {title}
      </h3>
      {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

const MetricCard = ({ Icon, label, value, sub, pct, iconCls }) => {
  const tone = pct != null ? toneFor(pct) : null;
  return (
    <div className={`${card} p-3.5 relative overflow-hidden`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
          <h4 className={`mt-1.5 text-base sm:text-xl font-extrabold ${tone ? tone.text : 'text-slate-800 dark:text-white'} truncate`}>{value}</h4>
          {sub && <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 leading-snug">{sub}</p>}
        </div>
        <div className={`${iconCls || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'} p-2 rounded-xl shrink-0`}>
          <Icon size={16} />
        </div>
      </div>
      {pct != null && (
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className={`h-full rounded-full ${tone.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
};

const RateValue = ({ rate, direction }) => {
  const isRx = direction === 'rx';
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${isRx ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}`}>
      {isRx ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
      {formatRate(rate)}
    </span>
  );
};

export default function RealtimeMonitor({ darkMode = false }) {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sheetRows, setSheetRows] = useState(null);
  const [sheetError, setSheetError] = useState('');
  const [period, setPeriod] = useState('daily');
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetchRouterStats();
        if (cancelled) return;
        setStats(res.data || null);
        setStatsError('');
      } catch (err) {
        if (cancelled) return;
        setStatsError(err && err.message ? err.message : 'Gagal memuat metrik perangkat.');
      } finally {
        inFlight.current = false;
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, STATS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchSheetRows();
        if (cancelled) return;
        setSheetRows(rows);
        setSheetError('');
      } catch (err) {
        if (cancelled) return;
        setSheetRows([]);
        setSheetError(err && err.message ? err.message : 'Gagal memuat data spreadsheet.');
      }
    };
    load();
    const timer = setInterval(load, SHEET_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const chartData = useMemo(() => {
    if (!sheetRows || !sheetRows.length) return [];
    return aggregate(computeDailyMB(sheetRows), period);
  }, [sheetRows, period]);

  const chartTotal = useMemo(() => chartData.reduce((sum, d) => sum + d.mb, 0), [chartData]);

  const sys = stats?.system;
  const interfaces = stats?.interfaces || [];
  const runningIfaces = interfaces.filter((i) => i.running);
  const totalRx = runningIfaces.reduce((s, i) => s + i.rxRate, 0);
  const totalTx = runningIfaces.reduce((s, i) => s + i.txRate, 0);
  const queues = stats?.queues || [];
  const netwatch = stats?.netwatch || [];
  const logs = stats?.logs || [];
  const wireless = stats?.wireless || [];

  const memUsed = sys ? Math.max(0, sys.totalMemory - sys.freeMemory) : 0;
  const memPct = sys ? safePct(memUsed, sys.totalMemory) : 0;
  const hddUsed = sys ? Math.max(0, sys.totalHdd - sys.freeHdd) : 0;
  const hddPct = sys ? safePct(hddUsed, sys.totalHdd) : 0;

  const netwatchUp = netwatch.filter((n) => n.status === 'up').length;
  const netwatchDown = netwatch.filter((n) => n.status === 'down').length;

  const logTone = (topics) => {
    const t = String(topics || '');
    if (/critical|error/.test(t)) return 'text-red-600 dark:text-red-400';
    if (/warning/.test(t)) return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-500 dark:text-slate-400';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* HEADER */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Router size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white truncate flex items-center gap-2">
                Pemantauan Jaringan MikroTik
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`absolute inline-flex h-full w-full rounded-full ${statsError ? 'bg-red-400' : 'bg-emerald-400'} opacity-75 ${statsError ? '' : 'animate-ping'}`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statsError ? 'bg-red-500' : 'bg-emerald-500'}`} />
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                {stats?.identity ? `${stats.identity} · ` : ''}Metrik realtime via tunnel VPN{stats?.syncedAt ? ` · sinkron ${new Date(stats.syncedAt).toLocaleTimeString('id-ID')}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <ArrowDown size={12} className="text-emerald-500" /> {formatRate(totalRx)}
              <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
              <ArrowUp size={12} className="text-sky-500" /> {formatRate(totalTx)}
            </span>
            {loading && <RefreshCw size={15} className="animate-spin text-slate-400" />}
          </div>
        </div>
        {statsError && (
          <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle size={13} /> {statsError}
          </p>
        )}
      </div>

      {/* 1. SYSTEM RESOURCE */}
      <div>
        <SectionTitle Icon={Server} title="Sumber Daya Perangkat" subtitle="CPU, memori, penyimpanan & status sistem" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard Icon={Cpu} label="CPU Load" value={sys ? `${sys.cpuLoad}%` : '—'}
            sub={sys ? `${sys.cpuCount} core · ${sys.cpuFrequency} MHz` : ''} pct={sys ? sys.cpuLoad : null}
            iconCls="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400" />
          <MetricCard Icon={MemoryStick} label="Memori (RAM)" value={sys ? formatBytes(memUsed) : '—'}
            sub={sys ? `dari ${formatBytes(sys.totalMemory)} · ${memPct.toFixed(0)}%` : ''} pct={sys ? memPct : null}
            iconCls="bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400" />
          <MetricCard Icon={HardDrive} label="Storage" value={sys ? formatBytes(hddUsed) : '—'}
            sub={sys ? `dari ${formatBytes(sys.totalHdd)} · ${hddPct.toFixed(0)}%` : ''} pct={sys ? hddPct : null}
            iconCls="bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400" />
          <MetricCard Icon={Clock} label="Uptime" value={sys?.uptime || '—'}
            sub={sys ? `${sys.boardName}${sys.model ? ` · ${sys.model}` : ''}` : ''}
            iconCls="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400" />
          <MetricCard Icon={Thermometer} label="Suhu" value={sys?.temperature != null ? `${sys.temperature}°C` : 'N/A'}
            sub="Sensor board" iconCls="bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" />
          <MetricCard Icon={Zap} label="Tegangan" value={sys?.voltage != null ? `${sys.voltage} V` : 'N/A'}
            sub="Power supply" iconCls="bg-yellow-50 dark:bg-yellow-950/60 text-yellow-600 dark:text-yellow-400" />
          <MetricCard Icon={Server} label="RouterOS" value={sys?.version ? sys.version.split(' ')[0] : '—'}
            sub={sys ? `${sys.architecture}${sys.upgradeFirmware ? ` · fw ${sys.upgradeFirmware}` : ''}` : ''}
            iconCls="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300" />
          <MetricCard Icon={Cpu} label="Serial / Board" value={sys?.boardName || '—'}
            sub={sys?.serialNumber || ''} iconCls="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>

      {/* 2. TRAFIK INTERFACE */}
      <div className={`${card} p-4 sm:p-6`}>
        <SectionTitle Icon={Network} title="Trafik Interface (Realtime)"
          subtitle="Kecepatan TX/RX aktual per interface"
          right={<span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><Activity size={13} /> {formatRate(totalRx + totalTx)}</span>} />
        {interfaces.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Tidak ada data interface.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-2 py-2 font-bold">Interface</th>
                  <th className="px-2 py-2 font-bold">Status</th>
                  <th className="px-2 py-2 font-bold text-right">RX</th>
                  <th className="px-2 py-2 font-bold text-right">TX</th>
                  <th className="px-2 py-2 font-bold text-right">Total Data</th>
                </tr>
              </thead>
              <tbody>
                {[...interfaces].sort((a, b) => Number(b.running) - Number(a.running) || (b.rxRate + b.txRate) - (a.rxRate + a.txRate)).map((i) => (
                  <tr key={i.name} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                      <span className="inline-flex items-center gap-2"><Cable size={13} className="text-slate-400 shrink-0" />{i.name}</span>
                      <span className="block text-[9px] text-slate-400 font-normal mt-0.5">{i.type}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${i.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        <span className={`h-2 w-2 rounded-full ${i.running ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        {i.disabled ? 'disabled' : i.running ? 'running' : 'down'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right"><RateValue rate={i.rxRate} direction="rx" /></td>
                    <td className="px-2 py-2.5 text-right"><RateValue rate={i.txRate} direction="tx" /></td>
                    <td className="px-2 py-2.5 text-right text-slate-500 dark:text-slate-400">{formatBytes(i.rxBytes + i.txBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. CONNECTIVITY + QUEUES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className={`${card} p-4 sm:p-5`}>
          <SectionTitle Icon={Gauge} title="Connection Tracking" subtitle="Sesi aktif difirewall" />
          <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{stats ? stats.connections : '—'}</p>
          <p className="text-[11px] text-slate-400 mt-1">koneksi sedang ditangani router</p>
        </div>
        <div className={`${card} p-4 sm:p-5`}>
          <SectionTitle Icon={ListChecks} title="DHCP Leases" subtitle="Klien penerima IP" />
          <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{stats ? stats.dhcp.bound : '—'}<span className="text-base font-bold text-slate-400"> / {stats ? stats.dhcp.total : '—'}</span></p>
          <p className="text-[11px] text-slate-400 mt-1">lease aktif (bound) dari total terdaftar</p>
        </div>
        <div className={`${card} p-4 sm:p-5`}>
          <SectionTitle Icon={Globe} title="Netwatch" subtitle="Monitor ketersediaan host" />
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-lg font-extrabold text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={18} /> {netwatch ? netwatchUp : '—'}</span>
            <span className="inline-flex items-center gap-1.5 text-lg font-extrabold text-red-600 dark:text-red-400"><XCircle size={18} /> {netwatch ? netwatchDown : '—'}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">host up / down</p>
          {netwatch.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
              {netwatch.map((n) => (
                <li key={n.host} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold truncate">{n.host}</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${n.status === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${n.status === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} />{n.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 4. SIMPLE QUEUE */}
      <div className={`${card} p-4 sm:p-6`}>
        <SectionTitle Icon={ArrowDownUp} title="Simple Queue"
          subtitle="Alokasi & pemakaian bandwidth per target"
          right={queues.length > 0 ? <span className="text-[11px] font-bold text-slate-400">{queues.length} queue</span> : null} />
        {queues.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Tidak ada simple queue terpasang.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-2 py-2 font-bold">Queue</th>
                  <th className="px-2 py-2 font-bold">Target</th>
                  <th className="px-2 py-2 font-bold text-right">Rate</th>
                  <th className="px-2 py-2 font-bold text-right">Total Data</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.name} className="border-b border-slate-50 dark:border-slate-800/60">
                    <td className="px-2 py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                      {q.name}{q.dynamic ? <span className="ml-2 text-[9px] text-slate-400 font-normal">dynamic</span> : null}
                    </td>
                    <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400">{q.target}</td>
                    <td className="px-2 py-2.5 text-right"><RateValue rate={q.rateIn} direction="rx" /> <span className="text-slate-300 dark:text-slate-600">/</span> <RateValue rate={q.rateOut} direction="tx" /></td>
                    <td className="px-2 py-2.5 text-right text-slate-500 dark:text-slate-400">{formatBytes(q.bytesIn + q.bytesOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. GRAFIK BANDWIDTH (dari spreadsheet) */}
      <div className={`${card} p-4 sm:p-6`}>
        <SectionHeaderWithToggle
          title="Grafik Bandwidth"
          subtitle="Tren pemakaian dari data spreadsheet"
          period={period}
          onPeriod={setPeriod}
          right={<span className="text-[11px] font-bold text-slate-400">Total: {formatBytes(chartTotal * 1048576)}</span>}
        />
        {sheetError ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 py-6 text-center flex items-center justify-center gap-1.5"><AlertTriangle size={13} /> {sheetError}</p>
        ) : chartData.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">{sheetRows == null ? 'Memuat data spreadsheet…' : 'Belum ada data spreadsheet untuk ditampilkan.'}</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis width={64} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => formatBytes(v * 1048576)} />
                <RechartsTooltip
                  formatter={(v) => [formatBytes(v * 1048576), 'Pemakaian']}
                  labelFormatter={(l) => `Periode ${l}`}
                  cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                  contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderRadius: '12px', border: 'none', color: darkMode ? '#e2e8f0' : '#0f172a' }}
                />
                <Bar dataKey="mb" name="Pemakaian" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 6. LOG & WIRELESS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <div className={`${card} p-4 sm:p-6`}>
          <SectionTitle Icon={ScrollText} title="Log & Alerts" subtitle="Catatan sistem terbaru" right={<span className="text-[11px] font-bold text-slate-400">{logs.length} entri</span>} />
          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Tidak ada log.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60 -mr-2 pr-2">
              {logs.map((l, idx) => (
                <li key={`${l.time}-${idx}`} className="py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{l.time}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 truncate">{l.topics}</span>
                  </div>
                  <p className={`text-[11px] leading-snug break-words ${logTone(l.topics)}`}>{l.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${card} p-4 sm:p-6`}>
          <SectionHeaderWithWirelessInfo count={wireless.length} />
          {wireless.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center flex flex-col items-center gap-2">
              <Wifi size={22} className="text-slate-300 dark:text-slate-600" />
              Tidak ada klien wireless terdeteksi (perangkat ini mungkin tidak memiliki radio WiFi).
            </p>
          ) : (
            <ul className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {wireless.map((w, idx) => (
                <li key={`${w.mac}-${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{w.mac || 'klien'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{w.interface} · {w.uptime}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0"><Signal size={12} /> {w.signal || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Header dengan tombol periode untuk grafik bandwidth
function SectionHeaderWithToggle({ title, subtitle, period, onPeriod, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-800 dark:text-white">
          <TrendingUp size={17} className="text-emerald-500 shrink-0" /> {title}
        </h3>
        {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" onClick={() => onPeriod(p.id)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${period === p.id ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeaderWithWirelessInfo({ count }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-800 dark:text-white">
          <Wifi size={17} className="text-emerald-500 shrink-0" /> Klien Wireless
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Klien terdaftar & kekuatan sinyal</p>
      </div>
      <span className="text-[11px] font-bold text-slate-400 shrink-0">{count} klien</span>
    </div>
  );
}
