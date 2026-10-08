import {
  ArrowRight, Bot, Cake, ChevronDown, Code2, Database, Gauge, GraduationCap, MapPin, Radar, ScanFace,
  Search, SearchCheck, ShieldAlert, ShieldCheck, Sparkles, Wifi, Zap
} from 'lucide-react';
import { Nav, Footer } from './LandingShell';
import { scrollToId } from './scroll';
import { APP_NAME, ABOUT_TEXT, STACK, FAQS, AUTHOR_NAME } from '../config';
import kerenFoto from '../assets/keren.png';

const FEATURES = [
  { Icon: Wifi, title: 'Pemantauan Kuota', desc: 'Pemakaian data tiap kamar dibaca otomatis dari Google Sheets setiap saat.' },
  { Icon: ShieldAlert, title: 'Manajemen FUP ISP', desc: 'Batas pemakaian (Fair Usage Policy) per ISP dipantau dengan peringatan dini.' },
  { Icon: ScanFace, title: 'Login Wajah', desc: 'Akses administrator dilindungi dua lapis: sandi + login wajah (face-api.js).' },
  { Icon: Bot, title: 'Asisten AI', desc: 'Tanya data dan analitik dashboard langsung ke Asisten bertenaga Groq, bisa lewat suara.' },
  { Icon: Radar, title: 'Tren Harian', desc: 'Grafik pemakaian 14 hari menunjukkan kebiasaan internet tiap kamar.' },
  { Icon: Zap, title: 'Reset Otomatis', desc: 'Kuota di-reset otomatis tiap bulan tanpa perlu masuk ke perangkat hotspot.' }
];

const TENTANG_CARDS = [
  {
    Icon: Radar, title: 'Pemantauan', badge: '24/7',
    desc: 'Pemakaian tiap kamar dibaca otomatis dari Google Sheets, lengkap dengan tren 14 hari, rata-rata harian, dan peringatan dini kamar yang mendekati batas FUP — semua diperbarui tanpa refresh manual.'
  },
  {
    Icon: ShieldCheck, title: 'Keamanan', badge: '2 Lapis',
    desc: 'Login admin dilindungi dua lapis: kata sandi + login wajah (face-api.js). Data wajah, sesi, dan kunci API hanya disimpan lokal di perangkat, tidak pernah dikirim ke server pihak ketiga.'
  },
  {
    Icon: Database, title: 'Data', badge: 'Live',
    desc: 'Spreadsheet Google Sheets jadi basis data resmi: riwayat kumulatif MikroTik dihitung menjadi pemakaian harian, dapat di-reset tiap bulan, dan mudah diperiksa ulang lewat halaman Cek Kuota.'
  },
  {
    Icon: Bot, title: 'Fitur AI Terbaru', badge: 'Baru',
    desc: 'Asisten AI Groq kini hadir dengan Chat AI ala ChatGPT plus widget melayang: jawaban streaming cepat, menganalisis data kost langsung dari spreadsheet, sekaligus membantu menjawab pertanyaan umum.'
  }
];

const FOUNDER_DETAILS = [
  { Icon: Cake, label: 'Umur', value: '21 Tahun' },
  { Icon: MapPin, label: 'Tempat / Tanggal Lahir', value: 'Tanjung Kubah / 26 September 2005' },
  { Icon: GraduationCap, label: 'Kampus', value: 'Politeknik Negeri Medan' },
  { Icon: Code2, label: 'Jurusan & Prodi', value: 'Teknik Komputer & Informatika — Teknologi Rekayasa Perangkat Lunak' }
];

export default function Home() {
  return (
    <div className="font-jakarta bg-white text-slate-600">
      <Nav path="/" />

      {/* ===== HERO ===== */}
      <section id="beranda" className="bg-brand-mist">
        <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 lg:px-0 lg:pb-20 lg:pt-20">
          <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.14em] text-brand-blue">
            <span className="inline-block h-1.5 w-10 rounded-full bg-brand-yellow" />
            {APP_NAME} — Internet Kost Intelijen
          </div>

          <h1 className="font-display mt-6 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-brand-navy sm:text-5xl lg:text-[64px]">
            Pantau Kuota Internet Kost, <span className="text-brand-blue">Transparan</span> &amp; Otomatis
          </h1>

          <div className="mt-6 flex w-fit items-center gap-2 rounded-full border border-brand-blue/25 bg-white px-4 py-2">
            <Sparkles className="h-4 w-4 text-brand-yellow" />
            <span className="text-[12.5px] font-bold text-slate-700">
              Tren pemakaian · Batas FUP · Asisten AI · Login wajah
            </span>
          </div>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-brand-slate">
            {APP_NAME} membantu pengelola kost memantau pemakaian internet setiap kamar secara real-time,
            menghitung usia kuota, memperingatkan kamar yang mendekati batas FUP, dan menyajikan semuanya
            dalam satu dashboard yang rapi dan mudah dipahami.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a href="#/cek-kuota" className="btn-accent">
              Cek Kuota Anak Kost <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#/speedtest" className="btn-ghost">Speed Test Internet</a>
          </div>

          <p className="mt-7 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[12px] font-bold text-emerald-600">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            Data diperbarui otomatis dari Google Sheets
          </p>
        </div>
      </section>

      {/* ===== TENTANG ===== */}
      <section id="tentang" className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-0">
          <p className="eyebrow">Tentang Aplikasi</p>
          <h2 className="section-title">Semua kebutuhan manajemen internet kost dalam satu tempat</h2>
          <div className="mt-6 max-w-[920px]">
            <p className="text-justify text-[15.5px] leading-relaxed text-brand-muted">{ABOUT_TEXT}</p>
            <p className="mt-5 text-justify text-[15.5px] leading-relaxed text-brand-muted">
              Aplikasi ini dirancang dan dibangun oleh <strong className="text-brand-navy">{AUTHOR_NAME}</strong> untuk
              memudahkan pengelolaan hotspot WiFi kost — dari pemantauan data, aturan FUP, hingga laporan berkala.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#fitur" onClick={e => { e.preventDefault(); scrollToId('fitur'); }} className="btn-ghost">Lihat Fitur <ArrowRight className="h-4 w-4" /></a>
            <a href="#teknologi" onClick={e => { e.preventDefault(); scrollToId('teknologi'); }} className="btn-ghost">Teknologi</a>
            <a href="#founder" onClick={e => { e.preventDefault(); scrollToId('founder'); }} className="btn-ghost"><Sparkles className="h-4 w-4" /> Kenali Founder</a>
          </div>
        </div>
      </section>

      {/* ===== INFO PENTING ===== */}
      <section id="info" className="bg-brand-mist py-16 lg:py-20">
        <div className="mx-auto max-w-[1100px] px-5 lg:px-0">
          <p className="eyebrow">Info Penting</p>
          <h2 className="section-title">Pemantauan, keamanan, data &amp; AI terbaru</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {TENTANG_CARDS.map(({ Icon, title, badge, desc }, i) => (
              <div key={title} className="card flex h-full flex-col p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${i % 2 ? 'bg-indigo-50 text-indigo-600' : 'bg-sky-50 text-brand-blue'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-[15px] font-extrabold text-brand-navy sm:text-[16px]">{title}</h3>
                  <span className="ml-auto rounded-full bg-brand-yellow/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-navy sm:text-[10.5px]">
                    {badge}
                  </span>
                </div>
                <p className="mt-4 text-justify text-[13px] leading-relaxed text-brand-muted sm:text-[13.5px]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOUNDER ===== */}
      <section id="founder" className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-0">
          <p className="eyebrow">Founder Aplikasi</p>
          <h2 className="section-title">Orang di balik {APP_NAME}</h2>
          <div className="mt-12 grid items-center gap-10 lg:grid-cols-5 lg:gap-14">
            <div className="lg:col-span-2">
              <div className="relative mx-auto w-full max-w-[380px]">
                <img
                  src={kerenFoto}
                  alt={`${AUTHOR_NAME} — Founder ${APP_NAME}`}
                  className="aspect-[4/5] w-full rounded-3xl object-cover object-center shadow-xl shadow-slate-200/70 ring-1 ring-slate-100"
                />
                <div className="absolute -bottom-5 left-1/2 w-max -translate-x-1/2 rounded-full bg-brand-blue px-6 py-2.5 text-[12.5px] font-extrabold text-white shadow-lg shadow-brand-blue/30">
                  Founder &middot; {AUTHOR_NAME}
                </div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <h3 className="font-display text-2xl font-extrabold text-brand-navy sm:text-3xl">{AUTHOR_NAME}</h3>
              <p className="mt-1.5 text-[14px] font-bold text-brand-blue">Founder &amp; Developer {APP_NAME}</p>
              <p className="mt-5 text-justify text-[15.5px] leading-relaxed text-brand-muted">
                {AUTHOR_NAME} adalah pendiri sekaligus pengembang di balik {APP_NAME}. Laki-laki kelahiran Tanjung Kubah,
                26 September 2005, kini berusia 21 tahun dan sedang menempuh studi akademik di Politeknik Negeri Medan
                &mdash; Jurusan Teknik Komputer &amp; Informatika, Program Studi Teknologi Rekayasa Perangkat Lunak.
                Pengalaman langsung mengelola jaringan hotspot kos menjadi alasan lahirnya aplikasi ini.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {FOUNDER_DETAILS.map(({ Icon, label, value }) => (
                  <div key={label} className="card flex items-start gap-3 p-4">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-brand-blue">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-brand-muted">{label}</span>
                      <span className="mt-0.5 block text-[13.5px] font-bold leading-snug text-brand-navy">{value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FITUR ===== */}
      <section id="fitur" className="bg-brand-ground py-16 lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-0">
          <p className="eyebrow">Fitur Unggulan</p>
          <h2 className="section-title">Lengkap untuk pengelola, mudah untuk pemilik &amp; penghuni</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <div key={title} className="card group p-6 transition-shadow hover:shadow-lg hover:shadow-slate-200/60">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${i % 2 ? 'bg-indigo-50 text-indigo-600' : 'bg-sky-50 text-brand-blue'} group-hover:scale-110 transition-transform`}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-[16.5px] font-extrabold text-brand-navy">{title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-brand-muted">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TEKNOLOGI ===== */}
      <section id="teknologi" className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-0">
          <p className="eyebrow">Teknologi</p>
          <h2 className="section-title">Dibuat menggunakan teknologi modern</h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-brand-muted">
            Kombinasi front-end modern, AI generatif, dan spreadsheet sebagai basis data — tanpa server mahal.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            {STACK.map(t => (
              <span key={t} className="rounded-full border border-brand-line bg-brand-ground px-4 py-2 text-[13.5px] font-bold text-brand-navy">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-12 rounded-2xl bg-brand-navy p-8 text-white sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="font-display text-2xl font-extrabold sm:text-3xl">Cek kuota langsung dari sini</p>
                <p className="mt-2 max-w-md text-[14.5px] text-slate-300">
                  Anak kost cukup mengetik nama penggunanya untuk melihat pemakaian kuota bulan ini.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="#/cek-kuota" className="btn-accent"><SearchCheck className="h-4 w-4" /> Cek Kuota</a>
                <a href="#/speedtest" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-[14.5px] font-bold text-white hover:bg-white/10"><Gauge className="h-4 w-4" /> Speed Test</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FITUR TERHUBUNG ===== */}
      <section className="bg-brand-ground py-16 lg:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-6 px-5 md:grid-cols-2 lg:px-0">
          <a href="#/cek-kuota" className="card group flex items-start gap-5 p-7 transition hover:shadow-xl hover:shadow-slate-200/70">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-brand-blue transition group-hover:bg-brand-blue group-hover:text-white">
              <Search className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-[17px] font-extrabold text-brand-navy">Cek Kuota Anak Kost</span>
              <span className="mt-1.5 block text-[13.5px] leading-relaxed text-brand-muted">
                Cari nama pengguna (misal: <span className="font-bold text-brand-navy">dian</span>) untuk melihat GB terpakai
                dan kategori pemakaian.
              </span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-brand-blue">Buka Halaman <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </span>
          </a>
          <a href="#/speedtest" className="card group flex items-start gap-5 p-7 transition hover:shadow-xl hover:shadow-slate-200/70">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-500 group-hover:text-white">
              <Gauge className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-[17px] font-extrabold text-brand-navy">Speed Test Internet</span>
              <span className="mt-1.5 block text-[13.5px] leading-relaxed text-brand-muted">
                Ukur kecepatan unduh &amp; unggah koneksi WiFi dari kamar dengan OpenSpeedTest.
              </span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-emerald-600">Buka Halaman <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </span>
          </a>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-[760px] px-5 lg:px-0">
          <p className="eyebrow">FAQ</p>
          <h2 className="section-title">Pertanyaan yang Sering Diajukan</h2>
          <div className="mt-10 space-y-4">
            {FAQS.map(f => (
              <details key={f.q} className="card group overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-bold text-brand-navy sm:p-6">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-brand-blue transition group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-6 text-[14.5px] leading-relaxed text-brand-muted sm:px-6">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}