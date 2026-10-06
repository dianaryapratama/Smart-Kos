// ==========================================
// Groq AI Client + Speech (STT/TTS) helpers
// ==========================================

export const GROQ_BASE = 'https://api.groq.com/openai/v1';
export const GROQ_CHAT_MODEL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GROQ_MODEL) || 'openai/gpt-oss-120b';
export const GROQ_STT_MODEL = 'whisper-large-v3-turbo';

export function getGroqKey() {
  if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_GROQ_API_KEY === 'string') {
    return import.meta.env.VITE_GROQ_API_KEY.trim();
  }
  return '';
}

export const formatGB = (mb) => `${(parseFloat(mb) / 1024).toFixed(2)} GB`;

// ---------------- CHAT ----------------

export async function groqChat({ messages, key = getGroqKey(), model = GROQ_CHAT_MODEL, temperature = 0.35, maxTokens = 700, signal } = {}) {
  if (!key) throw new Error('NO_KEY');
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal
  });
  if (!res.ok) {
    let msg = `Groq error ${res.status}`;
    try { const j = await res.json(); if (j && j.error && j.error.message) msg = `${j.error.message} (${res.status})`; } catch { /* abaikan */ }
    throw new Error(msg);
  }
  const j = await res.json();
  const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  return typeof content === 'string' ? content.trim() : '';
}

// ---------------- STT: Whisper (rekaman) ----------------

export async function groqTranscribe(blob, { key = getGroqKey(), model = GROQ_STT_MODEL } = {}) {
  if (!key) throw new Error('NO_KEY');
  const fd = new FormData();
  const isWebm = blob && typeof blob.type === 'string' && blob.type.includes('webm');
  fd.append('file', blob, isWebm ? 'rekaman.webm' : 'rekaman.ogg');
  fd.append('model', model);
  fd.append('language', 'id');
  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd
  });
  if (!res.ok) {
    let msg = `Whisper error ${res.status}`;
    try { const j = await res.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { /* abaikan */ }
    throw new Error(msg);
  }
  const j = await res.json();
  return (j && j.text ? String(j.text).trim() : '');
}

// ---------------- STT: Live Speech (Web Speech API) ----------------

export function speechRecognitionSupported() {
  const w = typeof window !== 'undefined' ? window : null;
  return Boolean(w && (w.SpeechRecognition || w.webkitSpeechRecognition));
}

export function createSpeechRecognizer({ lang = 'id-ID', onFinal, onInterim, onEnd, onError } = {}) {
  const w = typeof window !== 'undefined' ? window : null;
  const Ctor = w && (w.SpeechRecognition || w.webkitSpeechRecognition);
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const t = e.results[i][0] && e.results[i][0].transcript ? e.results[i][0].transcript : '';
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (final) onFinal && onFinal(final);
    if (interim) onInterim && onInterim(interim);
  };
  rec.onerror = (e) => onError && onError(e && e.error);
  rec.onend = () => onEnd && onEnd();
  return rec;
}

// ---------------- Recording (fallback Whisper) ----------------

export async function recordAudioOnce({ maxMs = 20000, isStopped = () => false } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  if (isStopped()) {
    stream.getTracks().forEach(t => t.stop());
    return { canceled: true, recorder: null, stop: () => {}, done: Promise.resolve({ blob: null, canceled: true }) };
  }
  let recorder;
  try {
    recorder = new MediaRecorder(stream);
  } catch (e) {
    stream.getTracks().forEach(t => t.stop());
    throw new Error('MediaRecorder tidak didukung browser ini.', { cause: e });
  }
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const type = recorder.mimeType || 'audio/webm;codecs=opus';
      resolve({ blob: new Blob(chunks, { type }), canceled: false });
    };
    recorder.onerror = (e) => {
      stream.getTracks().forEach(t => t.stop());
      reject((e && e.error) || new Error('Gagal merekam audio.'));
    };
  });
  recorder.start();
  const timer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, maxMs);
  return {
    canceled: false,
    recorder,
    stop: () => { clearTimeout(timer); if (recorder.state !== 'inactive') recorder.stop(); },
    done
  };
}

// ---------------- TTS (voice over) ----------------

let voicesCache = [];

function loadVoices() {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      voicesCache = window.speechSynthesis.getVoices();
    }
  } catch { /* abaikan */ }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch { /* abaikan */ }
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function pickIndonesianVoice() {
  const vs = voicesCache.length ? voicesCache : (() => { try { return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []; } catch { return []; } })();
  return vs.find(v => /^id[-_]ID/i.test(v.lang)) ||
    vs.find(v => /^id/i.test(v.lang)) ||
    vs.find(v => /indonesia/i.test(v.name)) ||
    null;
}

export function stopSpeaking() {
  try { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* abaikan */ }
}

export function speak(text, { rate = 1.05, pitch = 1 } = {}) {
  if (!ttsSupported() || !text) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      stopSpeaking();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickIndonesianVoice();
      if (v) u.voice = v;
      u.lang = (v && v.lang) ? v.lang : 'id-ID';
      u.rate = rate;
      u.pitch = pitch;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
    } catch {
      resolve(false);
    }
  });
}

// ---------------- Prompt & greeting (berbasis data dashboard) ----------------

export function buildSystemPrompt(analytics) {
  const a = analytics || {};
  const top = (Array.isArray(a.top) ? a.top : []).map(r => `${r.name} ${r.gb} GB`).join(', ');
  return `Kamu adalah asisten AI Bahasa Indonesia untuk dashboard "Smart Kost 50" (monitoring pemakaian internet per kamar). Jawab singkat dan jelas, maksimal 3-4 kalimat, pakai bahasa Indonesia santai namun profesional. Prioritaskan angka & nama kamar dari data ini. DATA DASHBOARD TERKINI:
- Kamar aktif: ${a.totalRooms ?? 0}
- Total trafik bulan ini: ${a.totalGB ?? 0} GB
- Rata-rata per kamar: ${a.avgGB ?? 0} GB
- Hari terpantau: ${a.activeDays ?? 0}, rata-rata harian ${a.avgDailyGB ?? 0} GB
- Puncak harian: ${a.peakLabel || 'belum ada'}
- 5 kamar terbesar: ${top || 'tidak ada'}
- Status FUP: ${a.ispStatus || 'Belum diatur'}${a.fupWorstName ? ` (terburuk ${a.fupWorstName} ${a.fupWorstPct}%)` : (a.fupCount ? `, ${a.fupCount} ISP dipantau` : '')}
Jangan mengarang angka di luar data. Kalau data kosong, katakan "belum ada data". Kalau ditanya soal reset data, jelaskan untuk pakai menu Reset Data di sidebar. Kalau ditanya cara menggunakan asisten, sebutkan bisa pakai tombol suara.`;
}

export function makeGreeting(analytics) {
  const a = analytics || {};
  const status = a.ispStatus || 'Belum diatur';
  const worst = a.fupWorstName ? ` (terburuk ${a.fupWorstName} ${a.fupWorstPct}%)` : '';
  return `Halo! Saya asisten dashboard Kost 50. Saat ini ada ${a.totalRooms || 0} kamar aktif dengan total trafik ${a.totalGB || 0} GB dan status FUP: ${status}${worst}. Tanyakan apa saja, misalnya "kamar mana yang paling boros?" atau "berapa rata-rata pemakaian per kamar?".`;
}

// ---------------- Pesan error ramah ----------------

export function friendlifyError(err) {
  const msg = err && err.message ? String(err.message) : String(err || 'Terjadi kesalahan.');
  if (msg === 'NO_KEY') return 'Kunci Groq belum terisi. Tambahkan VITE_GROQ_API_KEY di file .env.local lalu muat ulang.';
  if (/Failed to fetch|NetworkError|Network request failed/i.test(msg)) return 'Tidak dapat terhubung ke Groq. Periksa koneksi internet / izin HTTPS.';
  if (/401|invalid api key/i.test(msg)) return 'Kunci Groq tidak dikenali. Periksa kembali VITE_GROQ_API_KEY di .env.local.';
  if (/quota|rate limit|429/i.test(msg)) return 'Groq sedang penuh (rate limit). Tunggu sebentar lalu coba lagi.';
  return msg;
}