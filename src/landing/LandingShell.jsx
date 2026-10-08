import { APP_NAME, AUTHOR_NAME, COPYRIGHT_YEAR, STACK } from '../config';
import { scrollToId } from './scroll';

const NAV_SECTIONS = [
  { label: 'Beranda', id: 'beranda' },
  { label: 'Tentang', id: 'tentang' },
  { label: 'Fitur', id: 'fitur' },
  { label: 'Teknologi', id: 'teknologi' },
  { label: 'Founder', id: 'founder' },
  { label: 'FAQ', id: 'faq' }
];

export function Nav({ path = '/' }) {
  const isHome = path === '/';
  const onPage = p => (e) => {
    e.preventDefault();
    if (isHome && p.startsWith('/')) {
      const id = p.replace('/', '');
      scrollToId(id);
    } else {
      window.location.hash = '';
      setTimeout(() => scrollToId(p.replace('/', '')), 60);
    }
  };
  return (
    <header className="sticky top-0 z-40 border-b border-brand-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between gap-6 px-5 lg:px-0">
        <details className="group relative xl:hidden">
          <summary data-burger aria-label="Buka menu"
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-brand-line text-brand-navy">
            <svg strokeWidth="2" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </summary>
          <div className="absolute left-0 mt-3 w-60 rounded-2xl border border-brand-line bg-white p-3 shadow-xl">
            {isHome && NAV_SECTIONS.map(s => (
              <a key={s.id} href="#" onClick={onPage('/' + s.id)}
                className="block rounded-lg px-4 py-3 text-sm font-semibold text-brand-slate hover:bg-brand-ground">
                {s.label}
              </a>
            ))}
            {!isHome && (
              <a href="#/" className="block rounded-lg px-4 py-3 text-sm font-semibold text-brand-slate hover:bg-brand-ground">Beranda</a>
            )}
            <a href="#/cek-kuota"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-brand-ground">
              Cek Kuota
            </a>
            <a href="#/speedtest"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-brand-ground">
              Speed Test
            </a>
            <a href="#/chat-ai"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-brand-ground">
              Chat AI
            </a>
            <a href="#/login" className="mt-2 block rounded-lg bg-brand-blue px-4 py-3 text-center text-sm font-bold text-white">
              Masuk Admin
            </a>
          </div>
        </details>

        <a href="#/" className="flex items-center gap-3">
          <img src="/favicon.svg" alt="Logo Smart Kost" className="h-10 w-auto rounded-xl" />
          <span className="font-display text-xl font-extrabold text-brand-navy">{APP_NAME}</span>
        </a>

        <nav className="hidden items-center gap-7 text-[14.5px] font-semibold text-slate-600 xl:flex">
          {isHome && NAV_SECTIONS.map(s => (
            <a key={s.id} href="#" onClick={onPage('/' + s.id)}
              className="transition hover:text-brand-blue">
              {s.label}
            </a>
          ))}
          {!isHome && (
            <a href="#/" className="transition hover:text-brand-blue">Beranda</a>
          )}
          <a href="#/cek-kuota" className={`transition hover:text-brand-blue ${path === '/cek-kuota' ? 'text-brand-blue' : ''}`}>
            Cek Kuota
          </a>
          <a href="#/speedtest" className={`transition hover:text-brand-blue ${path === '/speedtest' ? 'text-brand-blue' : ''}`}>
            Speed Test
          </a>
          <a href="#/chat-ai" className={`transition hover:text-brand-blue ${path === '/chat-ai' ? 'text-brand-blue' : ''}`}>
            Chat AI
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a href="#/login"
            className="hidden items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-[14.5px] font-bold text-brand-navy transition hover:border-brand-blue hover:text-brand-blue sm:inline-flex">
            Masuk Admin
          </a>
          <a href="#/cek-kuota"
            className="hidden items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-[14.5px] font-bold text-white transition hover:bg-brand-blue-dark sm:inline-flex">
            Cek Kuota
            <svg strokeWidth="2" aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
          </a>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#0a1b34] text-white">
      <div className="mx-auto max-w-[1240px] px-5 py-14 lg:px-0">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-5 lg:col-span-4">
            <a href="#/" className="flex items-center gap-3 w-fit">
              <img src="/favicon.svg" alt="Logo Smart Kost" className="h-11 w-auto rounded-xl bg-white/10 p-1" />
              <span className="font-display text-xl font-extrabold">{APP_NAME}</span>
            </a>
            <p className="max-w-[330px] text-[13.5px] leading-relaxed text-slate-400">
              Dashboard manajemen internet WiFi hotspot &amp; FUP untuk kost. Pantau kuota setiap kamar, cek batas
              pemakaian, dan kelola akses secara aman.
            </p>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-brand-blue flex items-center justify-center text-white text-xs font-bold">D</span>
              <span className="text-[13px] font-bold text-slate-300">Dibuat oleh {AUTHOR_NAME}</span>
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="text-[12px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Navigasi</p>
            <ul className="space-y-3 text-[13.5px] font-semibold text-slate-300">
              <li><a href="#/" className="transition hover:text-white">Beranda</a></li>
              <li><a href="#/cek-kuota" className="transition hover:text-white">Cek Kuota</a></li>
              <li><a href="#/speedtest" className="transition hover:text-white">Speed Test</a></li>
              <li><a href="#/chat-ai" className="transition hover:text-white">Chat AI</a></li>
              <li><a href="#/login" className="transition hover:text-white">Login Admin</a></li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[12px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Layanan</p>
            <ul className="space-y-3 text-[13.5px] font-semibold text-slate-300">
              <li>Pemantauan Kuota Real-time</li>
              <li>Manajemen FUP ISP</li>
              <li>Login Wajah (Face ID)</li>
              <li>Asisten AI Groq</li>
              <li>Laporan &amp; Reset Bulanan</li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[12px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Teknologi</p>
            <div className="flex flex-wrap gap-2">
              {STACK.map(t => (
                <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11.5px] font-bold text-slate-300">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-center sm:flex-row sm:text-left">
          <p className="text-[12.5px] text-slate-400">
            &copy; {COPYRIGHT_YEAR} {AUTHOR_NAME}. Seluruh hak cipta dilindungi. {APP_NAME}.
          </p>
          <p className="text-[12.5px] text-slate-500">
            Dibuat dengan React, Vite, Groq AI &amp; Google Sheets
          </p>
        </div>
      </div>
    </footer>
  );
}