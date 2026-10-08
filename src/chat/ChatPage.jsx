import { useEffect, useRef, useState } from 'react';
import { Bot, ExternalLink, RefreshCw, Send, Square, User } from 'lucide-react';
import { useAiChat } from './useAiChat';
import RichText from './rich';
import { APP_NAME } from '../config';

const SUGGESTIONS = [
  'Kamar mana yang paling boros?',
  'Berapa total pemakaian seluruh kost?',
  'Bagaimana tren pemakaian harian?',
  'Kapan puncak pemakaian tertinggi?',
  'Siapa saja kamar yang pemakaiannya di atas rata-rata?'
];

function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ dataState, analytics }) {
  const s = dataState.status;
  const cls = s === 'ready' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : s === 'loading' ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-amber-50 text-amber-600 border-amber-200';
  const label = s === 'ready'
    ? `Data Google Sheets live · ${analytics.totalRooms} kamar · ${analytics.totalGB} GB · sync ${fmtTime(dataState.at)}`
    : s === 'loading' ? 'Memuat data spreadsheet…' : 'Data spreadsheet gagal dimuat';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s === 'ready' ? 'bg-emerald-500' : s === 'loading' ? 'bg-sky-500 animate-pulse' : 'bg-amber-500'}`} />
      {label}
    </span>
  );
}

export default function ChatPage() {
  const { messages, send, stop, reset, busy, dataState, hasKey } = useAiChat({ persistKey: 'smartkost.chat.page', maxHistory: 20 });
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const submit = () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    send(q);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const autosize = () => {
    const t = textareaRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-white font-jakarta text-slate-700">
      {/* Header slim */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <a href="#/" className="flex min-w-0 items-center gap-2.5">
            <img src="/favicon.svg" alt="Logo" className="h-8 w-auto shrink-0" />
            <span className="font-display truncate text-[16px] font-extrabold text-slate-800 sm:text-[17px]">
              <span className="sm:hidden">Chat AI</span>
              <span className="hidden sm:inline">Chat AI · {APP_NAME}</span>
            </span>
          </a>
          <div className="min-w-0 flex-1" />
          <div className="hidden md:block"><StatusBadge dataState={dataState} analytics={dataState.analytics} /></div>
          <a href="#/" title="Beranda"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 text-[12.5px] font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors sm:px-4">
            <span className="hidden sm:inline">Beranda</span> <ExternalLink size={13} />
          </a>
          <button type="button" onClick={reset} title="Chat baru"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 text-[12.5px] font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors sm:px-4">
            <RefreshCw size={13} /> <span className="hidden sm:inline">Chat Baru</span>
          </button>
        </div>
      </header>
      <div className="px-4 pt-3 sm:hidden"><StatusBadge dataState={dataState} analytics={dataState.analytics} /></div>

      {/* Messages */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-44 pt-4 sm:pb-40">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <img src="/favicon.svg" alt="" className="mx-auto h-16 w-auto" />
            <h1 className="font-display mt-5 text-2xl font-extrabold text-slate-800 sm:text-3xl">
              Tanya apa saja tentang data kost
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-slate-500">
              Jawaban didasarkan langsung pada Google Sheets hotspot — pemakaian per kamar, tren harian, dan perbandingan.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <span className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white mt-1"><Bot size={15} /></span>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap break-words sm:max-w-[75%] ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-slate-100 text-slate-700 rounded-bl-md'
              }`}>
                {m.role === 'assistant' ? <RichText text={m.text} /> : m.text}
              </div>
              {m.role === 'user' && (
                <span className="h-8 w-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 mt-1"><User size={15} /></span>
              )}
            </div>
          ))}
          {busy && messages.length && messages[messages.length - 1].role === 'user' && (
            <div className="flex gap-3 justify-start">
              <span className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white mt-1"><Bot size={15} /></span>
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      {/* Composer (docked) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
        <div className="mx-auto max-w-4xl">
          {messages.length === 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5 justify-center">
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" disabled={busy} onClick={() => send(s)}
                  className="text-[12px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-lg shadow-slate-200/60 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autosize(); }}
              onKeyDown={onKey}
              rows={1}
              disabled={busy}
              placeholder={hasKey ? 'Ketik pertanyaan… (Enter kirim, Shift+Enter baris baru)' : 'VITE_GROQ_API_KEY belum diisi'}
              aria-label="Pertanyaan"
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[14.5px] text-slate-800 placeholder-slate-400 outline-none disabled:opacity-60"
            />
            {busy && (
              <button type="button" onClick={stop} aria-label="Hentikan"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
                <Square size={16} />
              </button>
            )}
            <button type="button" aria-label="Kirim" disabled={busy || !input.trim()} onClick={submit}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25">
              <Send size={17} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10.5px] text-slate-400">
            Jawaban dihasilkan AI (Groq) dari data spreadsheet &mdash; bisa salah, cek angka kunci di dashboard admin. &copy; 2026 Dian Arya Pratama.
          </p>
        </div>
      </div>
    </div>
  );
}