import { useEffect, useRef, useState } from 'react';
import {
  MessageCircle, Mic, X, Send, Volume2, VolumeX, Sparkles,
  Bot, User, Activity, Square, Loader2, AlertTriangle, TrendingUp, Server
} from 'lucide-react';
import {
  getGroqKey, groqChat, groqTranscribe, speechRecognitionSupported,
  createSpeechRecognizer, recordAudioOnce,
  ttsSupported, speak, stopSpeaking, buildSystemPrompt, makeGreeting,
  friendlifyError, formatGB
} from './ai';

const SUGGESTIONS = ['Kamar paling boros?', 'Bagaimana status FUP?', 'Rata-rata pemakaian per kamar?'];

const CARD = 'rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl';

function Bars({ active, size = 24 }) {
  const bars = [];
  for (let i = 0; i < size; i += 1) {
    const delay = `${(i % 7) * 0.09}s`;
    bars.push(
      <span key={i} className="w-1 rounded-full bg-emerald-400"
        style={{
          height: active ? '60%' : '14%',
          transformOrigin: 'bottom',
          animation: active ? `assistant-dock-eq 0.9s ease-in-out infinite ${delay}` : 'none'
        }}
      />
    );
  }
  return <div className="flex items-end gap-[3px] h-12">{bars}</div>;
}

function MiniAnalytics({ analytics }) {
  const a = analytics || {};
  const items = [
    { label: 'Kamar', value: a.totalRooms ?? 0, Icon: Activity, cls: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50' },
    { label: 'Total', value: a.totalGB ? `${a.totalGB} GB` : '0', Icon: TrendingUp, cls: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50' },
    { label: 'FUP', value: a.ispStatus || 'Belum diatur', Icon: Server, cls: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50' }
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(it => (
        <div key={it.label} className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
            <it.Icon size={11} className={it.cls} /> {it.label}
          </div>
          <div className="text-xs font-extrabold text-slate-800 dark:text-white truncate">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsStrip({ analytics }) {
  const a = analytics || {};
  const top = Array.isArray(a.top) ? a.top.slice(0, 5) : [];
  const worst = a.fupWorstName ? `${a.fupWorstName} ${a.fupWorstPct}%` : `${a.fupCount ?? 0} ISP dipantau`;
  return (
    <div className="shrink-0 mx-3 mt-3 rounded-xl border border-indigo-200/70 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
          <Sparkles size={11} /> Analitik saat ini
        </p>
        <span className="text-[9px] text-slate-400 dark:text-slate-500">{formatGB(a.totalMB || 0)} total bulan ini</span>
      </div>
      <MiniAnalytics analytics={a} />
      {top.length > 0 && (
        <div className="mt-2.5 space-y-1">
          {top.map((r, i) => (
            <div key={r.name} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="w-4 text-right font-bold text-slate-400 dark:text-slate-500">{i + 1}</span>
              <span className="font-semibold truncate flex-1">{r.name}</span>
              <span className="text-slate-400 dark:text-slate-500">{r.mb} MB</span>
              <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(r.mb / Math.max(a.top[0].mb, 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
        <Server size={10} /> FUP terburuk: {worst} · puncak harian {a.peakLabel || 'belum ada'}
      </p>
    </div>
  );
}

function Assistant({ analytics }) {
  const [open, setOpen] = useState(null); // null | 'chat' | 'voice'
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tts, setTts] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(speechRecognitionSupported() ? 'live' : 'record');
  const [listeningLive, setListeningLive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voicePhase, setVoicePhase] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [lastReply, setLastReply] = useState('');

  const seeded = useRef(false);
  const recRef = useRef(null);
  const listeningRef = useRef(false);
  const recTokenRef = useRef(null);
  const liveFinalRef = useRef('');
  const msgsEndRef = useRef(null);
  const mountedRef = useRef(true);
  const hasKey = getGroqKey();

  useEffect(() => () => {
    mountedRef.current = false;
    listeningRef.current = false;
    if (recRef.current) { try { recRef.current.stop(); } catch { /* abaikan */ } }
    if (recTokenRef.current) { try { if (recTokenRef.current.done) recTokenRef.current.stop(); } catch { /* abaikan */ } }
    stopSpeaking();
  }, []);

  useEffect(() => {
    if (msgsEndRef.current && typeof msgsEndRef.current.scrollIntoView === 'function') msgsEndRef.current.scrollIntoView({ block: 'end' });
  }, [messages, busy, open]);

  function ensureGreeting() {
    if (!seeded.current) {
      seeded.current = true;
      setMessages([{ role: 'assistant', text: makeGreeting(analytics) }]);
    }
  }

  function closePanel() {
    setOpen(null);
    stopLive();
    stopRec();
    stopSpeaking();
    setSpeaking(false);
  }

  function toggleTts() {
    const nv = !tts;
    setTts(nv);
    if (!nv) { stopSpeaking(); setSpeaking(false); }
  }

  function stopLive() {
    listeningRef.current = false;
    if (recRef.current) { try { recRef.current.stop(); } catch { /* abaikan */ } recRef.current = null; }
    setListeningLive(false);
    setVoicePhase('');
  }

  function startLive() {
    setVoiceError('');
    if (recRef.current) { try { recRef.current.stop(); } catch { /* abaikan */ } recRef.current = null; }
    const rec = createSpeechRecognizer({
      onFinal: f => {
        liveFinalRef.current = `${liveFinalRef.current.replace(/\s+$/, '')} ${f}`.trim();
        if (mountedRef.current) setTranscript(liveFinalRef.current);
      },
      onInterim: t => {
        const base = liveFinalRef.current;
        if (mountedRef.current) setTranscript(base ? `${base} ${t}` : t);
      },
      onError: e => {
        if (e === 'not-allowed' || e === 'service-not-allowed') {
          listeningRef.current = false;
          if (mountedRef.current) {
            setVoiceError('Izin mikrofon ditolak. Izinkan mikrofon di browser, lalu coba lagi.');
            setListeningLive(false);
            setVoicePhase('');
          }
        } else if (e === 'network') {
          if (mountedRef.current) setVoiceError('Layanan pengenalan suara membutuhkan internet (HTTPS).');
        } else if (e !== 'no-speech' && e !== 'aborted') {
          if (mountedRef.current) setVoiceError(`Live speech error: ${e}`);
        }
      },
      onEnd: () => {
        if (!mountedRef.current) return;
        if (listeningRef.current) {
          // tetap ingin mendengarkan → mulai lagi agar tidak berhenti diam-diam
          try {
            rec.start();
            setVoicePhase('Mendengarkan… bicara sekarang');
          } catch {
            listeningRef.current = false;
            setListeningLive(false);
            setVoicePhase('');
          }
        } else {
          setListeningLive(false);
          setVoicePhase('');
        }
      }
    });
    if (!rec) {
      setVoiceError('Web Speech API tidak tersedia di browser ini. Gunakan mode Rekam.');
      return;
    }
    recRef.current = rec;
    listeningRef.current = true;
    setListeningLive(true);
    setVoicePhase('Mendengarkan… bicara sekarang');
    try {
      rec.start();
    } catch {
      listeningRef.current = false;
      recRef.current = null;
      setListeningLive(false);
      setVoicePhase('');
      setVoiceError('Gagal memulai pengenalan suara. Pastikan HTTPS/localhost dan izinkan mikrofon.');
    }
  }

  function startRec() {
    setVoiceError('');
    const token = { stopped: false };
    recTokenRef.current = token;
    setRecording(true);
    setVoicePhase('Merekam… bicara sekarang');
    (async () => {
      try {
        const ctrl = await recordAudioOnce({ maxMs: 20000, isStopped: () => recTokenRef.current !== token || token.stopped });
        if (ctrl.canceled || token.stopped || recTokenRef.current !== token) {
          // dibatalkan sebelum recorder jadi → bersih-bersih
          if (!ctrl.canceled) ctrl.stop();
          if (mountedRef.current) { setRecording(false); setVoicePhase(''); }
          return;
        }
        if (!mountedRef.current) { ctrl.stop(); return; }
        recTokenRef.current = ctrl;
      } catch {
        if (mountedRef.current) {
          setVoiceError('Izin mikrofon ditolak. Periksa pengaturan browser / pastikan HTTPS.');
          setRecording(false);
          setVoicePhase('');
        }
      }
    })();
  }

  function stopRec() {
    const h = recTokenRef.current;
    recTokenRef.current = null;
    if (!h) { setRecording(false); setVoicePhase(''); return; }
    if (h.done === undefined) {
      // masih menunggu izin/recorder → batalkan
      h.stopped = true;
      setRecording(false);
      setVoicePhase('');
      return;
    }
    try { h.stop(); } catch { /* abaikan */ }
    setRecording(false);
    setVoicePhase('Mengubah suara menjadi teks…');
    setBusy(true);
    (async () => {
      try {
        const { blob, canceled } = await h.done;
        if (canceled || !blob || blob.size === 0) {
          if (mountedRef.current) setVoicePhase('');
          return;
        }
        const text = await groqTranscribe(blob);
        if (mountedRef.current && text) {
          setTranscript(t => (t ? t.replace(/\s+$/, '') + ' ' + text : text));
        } else if (mountedRef.current) {
          setVoiceError('Tidak ada suara yang terdeteksi. Coba rekam lebih jelas.');
        }
      } catch (err) {
        if (mountedRef.current) setVoiceError(friendlifyError(err));
      } finally {
        if (mountedRef.current) { setBusy(false); setVoicePhase(''); }
      }
    })();
  }

  async function processVoice() {
    const q = transcript.trim();
    if (!q || busy) return;
    setBusy(true);
    setVoiceError('');
    setVoicePhase('Memikirkan jawaban…');
    setTranscript('');
    pushMessages([{ role: 'user', text: q }]);
    try {
      const reply = await askGroq(q);
      pushMessages([{ role: 'assistant', text: reply }]);
      setLastReply(reply);
      setVoicePhase('Selesai.');
      if (tts && ttsSupported()) {
        setSpeaking(true);
        setVoicePhase('Menyuarakan jawaban…');
        await speak(reply);
        if (mountedRef.current) setSpeaking(false);
      }
    } catch (err) {
      const m = friendlifyError(err);
      pushMessages([{ role: 'assistant', text: m }]);
      setLastReply(m);
      setVoicePhase('');
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function askGroq(q) {
    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.text }));
    return groqChat({
      messages: [
        { role: 'system', content: buildSystemPrompt(analytics) },
        ...history,
        { role: 'user', content: q }
      ]
    });
  }

  function pushMessages(items) {
    setMessages(m => [...m, ...items]);
  }

  async function sendChat() {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    pushMessages([{ role: 'user', text: q }]);
    try {
      const reply = await askGroq(q);
      pushMessages([{ role: 'assistant', text: reply }]);
      if (tts && ttsSupported()) {
        setSpeaking(true);
        await speak(reply);
        if (mountedRef.current) setSpeaking(false);
      }
    } catch (err) {
      pushMessages([{ role: 'assistant', text: friendlifyError(err) }]);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  function sendSuggestion(s) {
    setInput('');
    setBusy(true);
    pushMessages([{ role: 'user', text: s }]);
    (async () => {
      try {
        const reply = await askGroq(s);
        pushMessages([{ role: 'assistant', text: reply }]);
        if (tts && ttsSupported()) {
          setSpeaking(true);
          await speak(reply);
          if (mountedRef.current) setSpeaking(false);
        }
      } catch (err) {
        pushMessages([{ role: 'assistant', text: friendlifyError(err) }]);
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
  }

  const liveSupported = speechRecognitionSupported();
  const voiceActive = listeningLive || recording || busy || speaking;
  const isLive = voiceMode === 'live' && liveSupported;
  const panelWidth = open === 'chat' ? 'sm:w-[min(92vw,560px)]' : 'sm:w-[min(92vw,480px)]';

  return (
    <>
      <style>{`@keyframes assistant-dock-eq { 0%,100% { transform: scaleY(0.45); } 50% { transform: scaleY(1); } }
@keyframes assistant-dock-blink1 { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,.50), 0 10px 24px -6px rgba(16,185,129,.55); } 50% { box-shadow: 0 0 0 9px rgba(16,185,129,0), 0 10px 24px -6px rgba(16,185,129,.75); } }
@keyframes assistant-dock-blink2 { 0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,.45), 0 10px 24px -6px rgba(99,102,241,.5); } 50% { box-shadow: 0 0 0 9px rgba(99,102,241,0), 0 10px 24px -6px rgba(99,102,241,.7); } }`}</style>

      {/* PANEL */}
      {open && (
        <div className={`fixed bottom-[5.5rem] inset-x-3 z-[80] flex flex-col max-h-[78vh] sm:inset-x-auto sm:right-4 ${panelWidth} print:hidden`}>
          {open === 'chat' ? (
            <div className={`${CARD} flex flex-col max-h-[78vh] overflow-hidden`}>
              <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white shrink-0">
                <div className="p-2 bg-white/15 rounded-xl"><Sparkles size={17} /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-sm leading-tight">Asisten AI · Groq</h3>
                  <p className="text-[10px] text-indigo-100 truncate">Tanya seputar data kost {formatGB(analytics.totalMB || 0)} bulan ini</p>
                </div>
                <button aria-label={tts ? 'Matikan suara' : 'Nyalakan suara'} type="button" onClick={toggleTts}
                  className={`p-2 rounded-lg transition-colors ${tts ? 'bg-white/20 hover:bg-white/30' : 'bg-black/20 hover:bg-black/30'}`}>
                  {tts ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button aria-label="Tutup panel chat" type="button" onClick={closePanel} className="p-2 rounded-lg hover:bg-white/20 transition-colors"><X size={16} /></button>
              </div>

              <AnalyticsStrip analytics={analytics} />

              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <span className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shrink-0 mt-0.5"><Bot size={13} /></span>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-md'
                    }`}>{m.text}</div>
                    {m.role === 'user' && (
                      <span className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5"><User size={13} /></span>
                    )}
                  </div>
                ))}
                {busy && (
                  <div className="flex gap-2 justify-start">
                    <span className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shrink-0 mt-0.5"><Bot size={13} /></span>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={msgsEndRef} />
              </div>

              <div className="shrink-0 px-3 pb-2">
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} type="button" disabled={busy} onClick={() => sendSuggestion(s)}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-500/30 px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder={hasKey ? 'Tanya asisten…' : 'VITE_GROQ_API_KEY belum diisi…'}
                    disabled={busy}
                    aria-label="Pertanyaan"
                    className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                  />
                  <button aria-label="Kirim" type="button" disabled={busy || !input.trim()}
                    onClick={sendChat}
                    className="shrink-0 p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25">
                    {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${CARD} flex flex-col max-h-[78vh] overflow-hidden`}>
              <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white shrink-0">
                <div className="p-2 bg-white/15 rounded-xl"><Mic size={17} /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-sm leading-tight">Asisten Suara</h3>
                  <p className="text-[10px] text-emerald-100 truncate">{tts ? 'Bicaralah, jawaban akan disuarakan' : 'Mode hening (jawaban tanpa suara)'}</p>
                </div>
                <button aria-label={tts ? 'Matikan suara' : 'Nyalakan suara'} type="button" onClick={toggleTts}
                  className={`p-2 rounded-lg transition-colors ${tts ? 'bg-white/20 hover:bg-white/30' : 'bg-black/20 hover:bg-black/30'}`}>
                  {tts ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button aria-label="Tutup panel suara" type="button" onClick={closePanel} className="p-2 rounded-lg hover:bg-white/20 transition-colors"><X size={16} /></button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                <MiniAnalytics analytics={analytics} />

                <div className="mt-3 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-4">
                  {voiceActive ? <Bars active /> : (
                    <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
                      <Mic size={22} />
                      <span className="text-[10px] font-semibold">Menunggu pertanyaan</span>
                    </div>
                  )}
                </div>

                {voiceActive && (
                  <p className="mt-2 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                    {(recording || listeningLive) && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                    {speaking ? 'Menyuarakan jawaban…' : voicePhase || '…'}
                  </p>
                )}

                <div className="mt-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Transkrip pertanyaan</p>
                  <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    rows={2}
                    disabled={listeningLive || recording || busy}
                    placeholder="Bicara untuk mengisi, atau ketik di sini."
                    aria-label="Transkrip pertanyaan"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none disabled:opacity-60"
                  />
                </div>

                <div className="mt-3 flex gap-2">
                  <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-[11px] font-bold shrink-0">
                    <button type="button" onClick={() => { stopLive(); stopRec(); setVoiceMode('live'); setVoiceError(''); }}
                      disabled={!liveSupported}
                      className={`px-3 py-2 transition-colors disabled:opacity-40 ${voiceMode === 'live' ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                      Live
                    </button>
                    <button type="button" onClick={() => { stopLive(); stopRec(); setVoiceMode('record'); setVoiceError(''); }}
                      className={`px-3 py-2 transition-colors ${voiceMode === 'record' ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                      Rekam
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy || (voiceMode === 'live' && !liveSupported)}
                    onClick={() => {
                      if (isLive) {
                        listeningLive ? stopLive() : startLive();
                      } else {
                        (recTokenRef.current || recording) ? stopRec() : startRec();
                      }
                    }}
                    className={`flex-1 min-w-0 flex items-center justify-center gap-2 rounded-xl text-sm font-bold px-3 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      listeningLive || recording
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/25'
                    }`}>
                    {listeningLive || recording ? (<><Square size={14} /> Stop</>) : isLive ? (<><Mic size={14} /> Dengarkan</>) : (<><Mic size={14} /> Rekam</>)}
                  </button>
                </div>

                {voiceMode === 'record' && !recording && !busy && (
                  <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 text-center">
                    Tekan <b>Rekam</b> lalu bicara, tekan <b>Stop</b> untuk mengirim ke Whisper.
                  </p>
                )}

                <button
                  type="button"
                  disabled={busy || !transcript.trim()}
                  onClick={processVoice}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold px-3 py-2.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {busy ? 'Memproses…' : 'Proses Pertanyaan'}
                </button>

                {voiceError && (
                  <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 p-3 text-xs font-medium">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{voiceError}</span>
                  </div>
                )}

                {lastReply && (
                  <div className="mt-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Jawaban</p>
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-500/20 px-3.5 py-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">
                      {lastReply}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAB — mobile: tengah; desktop: kanan bawah */}
      <div className="fixed bottom-4 inset-x-0 z-[80] flex flex-col items-center gap-2 sm:items-end sm:right-4 sm:bottom-5 print:hidden">
        {speaking && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-full px-2.5 py-1 shadow border border-slate-200 dark:border-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Menyuarakan
          </div>
        )}
        <div className="flex items-end justify-center gap-3 sm:justify-end">
          <button
            type="button"
            aria-label="Buka asisten chat"
            title="Asisten Chat"
            onClick={() => { ensureGreeting(); setOpen(open === 'chat' ? null : 'chat'); }}
            className="relative overflow-hidden rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-transform border-2 border-white dark:border-slate-800"
            style={{ width: 50, height: 50, animation: open === 'chat' ? 'none' : 'assistant-dock-blink2 2.4s ease-in-out infinite' }}>
            <span className="pointer-events-none absolute inset-x-2 top-1 h-1/2 rounded-full bg-white/30" />
            {open === 'chat' ? <X size={21} /> : <MessageCircle size={21} />}
          </button>
          <button
            type="button"
            aria-label="Buka asisten suara"
            title="Asisten Suara"
            onClick={() => { setOpen(open === 'voice' ? null : 'voice'); }}
            className="relative overflow-hidden rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 hover:scale-105 active:scale-95 transition-transform border-2 border-white dark:border-slate-800"
            style={{ width: 56, height: 56, animation: open === 'voice' ? 'none' : (listeningLive || recording || speaking) ? 'assistant-dock-blink1 1.2s ease-in-out infinite' : 'assistant-dock-blink1 2.4s ease-in-out infinite' }}>
            <span className="pointer-events-none absolute inset-x-2 top-1 h-1/2 rounded-full bg-white/30" />
            {open === 'voice' ? <X size={22} /> : (listeningLive || recording || speaking) ? <Square size={20} /> : <Mic size={22} />}
          </button>
        </div>
      </div>
    </>
  );
}

export default Assistant;