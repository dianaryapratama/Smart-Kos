import { useEffect, useRef, useState } from 'react';
import { Bot, ExternalLink, Loader2, MessageCircle, RefreshCw, Send, Square, User, X } from 'lucide-react';
import { useAiChat } from './useAiChat';
import RichText from './rich';
import { formatGB } from '../ai';

const SUGGESTIONS = ['Kamar paling boros?', 'Berapa rata-rata pemakaian per kamar?', 'Puncak pemakaian tertinggi kapan?'];

export default function ChatWidget({ persistKey = 'smartkost.chat.widget' }) {
  const { messages, send, stop, reset, busy, dataState, hasKey } = useAiChat({ persistKey });
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ block: 'nearest' });
  }, [messages, busy, open]);

  const submit = () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    send(q);
  };

  const busyText = busy && (messages.length === 0 || messages[messages.length - 1].role === 'user');

  return (
    <>
      {open && (
        <div className="fixed bottom-[5.5rem] right-3 left-3 z-[90] mx-auto flex h-[min(80vh,600px)] w-[min(100%,400px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:left-auto sm:right-4 sm:h-[min(72vh,620px)] print:hidden">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Bot size={18} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold leading-tight">Chat AI · Smart Kost</h3>
              <p className="truncate text-[10px] text-indigo-100">
                {dataState.status === 'loading' && 'Memuat data spreadsheet…'}
                {dataState.status === 'ready' && `Data hidup · ${formatGB(dataState.analytics.totalMB || 0)} total`}
                {dataState.status === 'error' && 'Data belum dimuat · chat tetap bisa dipakai'}
              </p>
            </div>
            <a href="#/chat-ai" title="Buka di halaman penuh" className="p-2 rounded-lg hover:bg-white/20 transition-colors">
              <ExternalLink size={16} />
            </a>
            <button type="button" aria-label="Tutup" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/20 transition-colors"><X size={16} /></button>
          </div>

          {/* Message list */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <span className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white mt-0.5"><Bot size={13} /></span>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                  m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm'
                }`}>
                  {m.role === 'assistant' ? <RichText text={m.text} /> : m.text}
                </div>
                {m.role === 'user' && (
                  <span className="h-7 w-7 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 mt-0.5"><User size={13} /></span>
                )}
              </div>
            ))}
            {busyText && (
              <div className="flex gap-2 justify-start">
                <span className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white mt-0.5"><Bot size={13} /></span>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} type="button" disabled={busy} onClick={() => { setInput(''); send(s); }}
                    className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder={hasKey ? 'Tanya data kost…' : 'VITE_GROQ_API_KEY belum diisi'}
                disabled={busy}
                aria-label="Pertanyaan"
                className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
              />
              <button type="button" aria-label="Kirim" disabled={busy || !input.trim()} onClick={submit}
                className="shrink-0 p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25">
                {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                <RefreshCw size={11} /> Chat baru
              </button>
              <button type="button" onClick={stop} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-40" disabled={!busy}>
                <Square size={10} /> Hentikan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button type="button" aria-label="Buka Chat AI" title="Chat AI"
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-4 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-transform border-2 border-white print:hidden">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}