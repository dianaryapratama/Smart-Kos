import { Gauge, Router, Signal, Wifi } from 'lucide-react';
import { Nav, Footer } from './LandingShell';

const TIPS = [
  { Icon: Wifi, title: 'Dekat dengan Router', desc: 'Jalankan tes di kamar tempat kamu paling sering beraktivitas.' },
  { Icon: Router, title: 'Gunakan Kabel (opsional)', desc: 'WiFi 5 GHz atau kabel memberikan hasil paling stabil.' },
  { Icon: Signal, title: 'Tutup Aplikasi Lain', desc: 'Matikan unduhan / streaming agar hasil tes akurat.' }
];

export default function SpeedTest() {
  return (
    <div className="font-jakarta bg-white text-slate-600">
      <Nav path="/speedtest" />

      <section className="bg-brand-mist">
        <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-12 text-center lg:px-0">
          <p className="eyebrow mx-auto flex w-fit items-center gap-2">
            <span className="inline-block h-1.5 w-10 rounded-full bg-brand-yellow" /> Speed Test
          </p>
          <h1 className="font-display mx-auto mt-5 max-w-2xl text-3xl font-extrabold tracking-tight text-brand-navy sm:text-5xl">
            Seberapa Cepat Internet Kostmu?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-brand-slate">
            Ukur kecepatan unduh &amp; unggah koneksi WiFi kamu sekarang. Jalankan tes beberapa kali di waktu
            berbeda untuk hasil yang lebih akurat.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-12 lg:px-0">
        <div className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-center gap-2 border-b border-brand-line bg-brand-ground px-5 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-3 flex items-center gap-1.5 text-[12.5px] font-bold text-brand-muted">
              <Gauge className="h-4 w-4 text-emerald-500" /> Hybrid Speed Test
            </span>
          </div>
          <div className="flex flex-col items-center px-4 py-6 sm:py-8">
            <iframe
              src="https://hybridspeedtest.com/widget"
              width="480"
              height="880"
              frameborder="0"
              scrolling="yes"
              title="Internet Speed Test Widget"
              style={{ border: 0, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxWidth: '100%' }}
            />
            <p className="text-[11.5px] font-semibold text-brand-muted mt-2">
              Gulir ke bawah di dalam kotak untuk melihat AI Diagnostic.
            </p>
            <div style={{ textAlign: 'right', fontSize: '11px', marginTop: '6px', fontFamily: 'sans-serif' }}>
              <a href="https://hybridspeedtest.com/" target="_blank" rel="noopener" style={{ color: '#888', textDecoration: 'none' }}>
                Powered by Hybrid Speed Test
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {TIPS.map(({ Icon, title, desc }) => (
            <div key={title} className="card flex items-start gap-4 p-6">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-brand-blue">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[15px] font-extrabold text-brand-navy">{title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-brand-muted">{desc}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}