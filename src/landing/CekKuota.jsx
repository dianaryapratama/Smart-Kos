import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import {
  AlertCircle, ArrowRight, CalendarDays, Gauge, History, Loader2, Search,
  SearchX, UserRound
} from 'lucide-react';
import { Nav, Footer } from './LandingShell';
import { HOTSPOT_CSV_URL, KUOTA_CATEGORIES } from '../config';
import { mbToGB, aggregateByUser, parseCsvRows, formatDateTs } from './kuota';

const CAT_META = {
  normal: { chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  waspada: { chip: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  abnormal: { chip: 'bg-red-100 text-red-700', bar: 'bg-red-500', dot: 'bg-red-500' }
};

export default function CekKuota() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | empty | error
  const [errorMsg, setErrorMsg] = useState('');
  const [rows, setRows] = useState([]);

  const runSearch = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    setStatus('loading');
    Papa.parse(HOTSPOT_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const { data, errors } = res;
        if (errors.length) {
          setErrorMsg('Gagal membaca data: ' + (errors[0].message || 'format CSV tidak cocok'));
          setStatus('error');
          return;
        }
        const parsed = parseCsvRows(data);
        if (!parsed.length) {
          setErrorMsg('Data kuota masih kosong atau format CSV tidak dikenali.');
          setStatus('error');
          return;
        }
        setRows(parsed);
        setStatus('done');
        setErrorMsg('');
      },
      error: () => {
        setErrorMsg('Gagal memuat data. Cek koneksi atau konfigurasi URL CSV.');
        setStatus('error');
      }
    });
  };

  const byUser = useMemo(() => aggregateByUser(rows), [rows]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || status !== 'done') return [];
    return byUser.users.filter(u => u.name.toLowerCase().includes(q));
  }, [query, status, byUser]);

  const loading = status === 'loading';

  return (
    <div className="font-jakarta bg-white text-slate-600">
      <Nav path="/cek-kuota" />

      <section className="bg-brand-mist">
        <div className="mx-auto max-w-[760px] px-5 pb-14 pt-12 text-center lg:px-0">
          <p className="eyebrow mx-auto flex w-fit items-center gap-2">
            <span className="inline-block h-1.5 w-10 rounded-full bg-brand-yellow" /> Cek Kuota Anak Kost
          </p>
          <h1 className="font-display mt-5 text-3xl font-extrabold tracking-tight text-brand-navy sm:text-5xl">
            Berapa GB Kuotamu Bulan Ini?
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-brand-slate">
            Ketik <strong className="text-brand-navy">nama pengguna</strong> (username) WiFi kamu, lalu lihat total
            pemakaian dan kategori kuota.
          </p>

          <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={e => { e.preventDefault(); runSearch(); }}>
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Contoh: dian"
                aria-label="Nama pengguna"
                className="w-full rounded-full border border-brand-line bg-white py-4 pl-12 pr-5 text-[15px] font-semibold text-brand-navy outline-none placeholder:text-slate-400 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
              />
            </label>
            <button type="submit" disabled={!query.trim() || loading}
              className="btn-accent disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheckIcon />}
              {loading ? 'Mencari…' : 'Cari'}
            </button>
          </form>

          <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-2.5 text-[12px] font-bold">
            {Object.keys(CAT_META).map(k => (
              <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${CAT_META[k].chip}`}>
                <span className={`h-2 w-2 rounded-full ${CAT_META[k].dot}`} /> {KUOTA_CATEGORIES[k].label}
              </span>
            ))}
            <span className="w-full text-center text-slate-400 sm:w-auto sm:text-left">
              Kategori dihitung dari rata-rata pemakaian semua kamar.
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[760px] px-5 py-12 lg:px-0">
        {status === 'error' && (
          <div className="card flex items-start gap-4 border-red-200 bg-red-50 p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="font-bold text-red-700">Terjadi kesalahan</p>
              <p className="mt-1 text-[13.5px] text-red-600">{errorMsg}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-14 text-brand-muted">
            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
            <p className="text-[14px] font-semibold">Memuat data kuota dari Google Sheets…</p>
          </div>
        )}

        {status === 'done' && results.length === 0 && (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <SearchX className="h-10 w-10 text-slate-300" />
            <p className="text-[16px] font-extrabold text-brand-navy">Nama &ldquo;{query.trim()}&rdquo; tidak ditemukan</p>
            <p className="max-w-sm text-[13.5px] text-brand-muted">
              Periksa ejaan username kamu. Data dikirim sesuai username WiFi di MikroTik.
            </p>
          </div>
        )}

        {status === 'done' && results.length > 0 && (
          <>
            <p className="mb-4 text-[13.5px] font-bold text-brand-muted">
              Menampilkan {results.length} hasil untuk &ldquo;{query.trim()}&rdquo;
            </p>
            <div className="space-y-5">
              {results.map(u => (
                <div key={u.name} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-line p-6">
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white ${u.color}`}>
                        <UserRound className="h-6 w-6" />
                      </span>
                      <div>
                        <p className="text-[16.5px] font-extrabold text-brand-navy">{u.name}</p>
                        <p className="text-[12.5px] font-semibold text-brand-muted">{u.n} pembacaan router</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold ${CAT_META[u.cat].chip}`}>
                      {KUOTA_CATEGORIES[u.cat].label}
                    </span>
                  </div>

                  <div className="p-6">
                    <div className="flex items-end justify-between gap-4">
                      <p className="font-display text-5xl font-extrabold tracking-tight text-brand-navy">
                        {mbToGB(u.latest)} <span className="text-2xl text-brand-muted">GB</span>
                      </p>
                      <p className="text-[13px] font-semibold text-brand-muted">
                        = <span className="font-extrabold text-brand-navy">{u.latest.toLocaleString('id-ID', { maximumFractionDigits: 0 })} MB</span>
                      </p>
                    </div>
                    <p className="mt-1.5 text-[11.5px] font-semibold text-brand-muted">
                      Angka kumulatif dari pembacaan terakhir MikroTik — sama dengan dashboard admin.
                    </p>

                    <div className="mt-5">
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full transition-all ${CAT_META[u.cat].bar}`}
                          style={{ width: `${Math.max(6, Math.round(u.pct * 100))}%` }} />
                      </div>
                      <p className="mt-2 text-[11.5px] font-semibold text-brand-muted">
                        {Math.round(u.pct * 100)}% dari pemakaian tertinggi bulan ini
                      </p>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <div className="flex items-center gap-3 rounded-xl bg-brand-ground p-4">
                        <CalendarDays className="h-5 w-5 shrink-0 text-brand-blue" />
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Terpantau sejak</p>
                          <p className="text-[15px] font-extrabold text-brand-navy">{formatDateTs(u.firstTs)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl bg-brand-ground p-4">
                        <History className="h-5 w-5 shrink-0 text-brand-blue" />
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Pembacaan router</p>
                          <p className="text-[15px] font-extrabold text-brand-navy">{u.n}×</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl bg-brand-ground p-4">
                        <Gauge className="h-5 w-5 shrink-0 text-brand-blue" />
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Terakhir diperbarui</p>
                          <p className="text-[15px] font-extrabold text-brand-navy">{formatDateTs(u.lastTs)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl bg-brand-navy p-8 text-center text-white">
          <p className="font-display text-xl font-extrabold">Pengelola kost?</p>
          <p className="max-w-md text-[14px] text-slate-300">
            Lihat rekap lengkap, kelola FUP, dan reset kuota dari dashboard administrator.
          </p>
          <a href="#/login" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14.5px] font-bold text-brand-navy hover:bg-slate-100">
            Buka Dashboard Admin <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function SearchCheckIcon() {
  return (
    <svg strokeWidth="2" aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
      <path d="m9 11 1.6 1.6L13.5 9.5" />
    </svg>
  );
}