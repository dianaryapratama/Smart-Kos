import { useCallback, useEffect, useRef, useState } from 'react';
import { getGroqKey, groqChat, groqChatStream, friendlifyError, makeGreeting } from '../ai';
import { getChatData, buildDeepSystemPrompt } from '../aiData';

function loadLocal(key) {
  if (!key) return null;
  try {
    const s = localStorage.getItem(key);
    if (s) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch { /* abaikan */ }
  return null;
}

export function useAiChat({ persistKey = null, maxHistory = 16 } = {}) {
  const [messages, setMessages] = useState(() => loadLocal(persistKey) || []);
  const [dataState, setDataState] = useState({ status: 'loading', analytics: null, model: null, at: null });
  const [busy, setBusy] = useState(false);

  const busyRef = useRef(false);
  const abortRef = useRef(null);
  const seedRef = useRef(false);

  // Ambil data spreadsheet (cache dibagikan antar halaman) + bibit greeting saat pertama kali
  useEffect(() => {
    let on = true;
    const seedIfEmpty = (greeting) => {
      if (on && !seedRef.current && !loadLocal(persistKey)?.length) {
        setMessages([{ role: 'assistant', text: greeting }]);
      }
      seedRef.current = true;
    };
    getChatData()
      .then(d => {
        if (on) setDataState({ status: 'ready', analytics: d.analytics, model: d.model, at: d.at });
        seedIfEmpty(makeGreeting(d.analytics));
      })
      .catch(() => {
        if (on) setDataState({ status: 'error', analytics: null, model: null, at: null });
        seedIfEmpty('Halo! Saya asisten AI Smart Kost. Sepertinya data spreadsheet belum bisa dimuat saat ini — Anda tetap bisa bertanya, nanti akan coba disambungkan kembali.');
      });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist riwayat
  useEffect(() => {
    if (!persistKey) return;
    try { localStorage.setItem(persistKey, JSON.stringify(messages.slice(-40))); } catch { /* abaikan */ }
  }, [messages, persistKey]);

  const send = useCallback(async (raw) => {
    const text = String(raw || '').trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    const { analytics, model } = dataState;
    const controller = new AbortController();
    abortRef.current = controller;

    const history = [];
    for (let i = messages.length - maxHistory; i < messages.length; i += 1) {
      const mm = messages[i];
      if (mm) history.push({ role: mm.role, content: mm.text });
    }

    setMessages(m => [...m, { role: 'user', text }, { role: 'assistant', text: '' }]);

    const applyDelta = (delta) => {
      setMessages(m => {
        const copy = m.slice();
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { role: 'assistant', text: (last ? last.text : '') + delta };
        return copy;
      });
    };

    const prompt = buildDeepSystemPrompt(model, analytics);
    try {
      let gotAny = false;
      if (!model) {
        const reply = await groqChat({ messages: [{ role: 'system', content: prompt }, ...history, { role: 'user', content: text }], signal: controller.signal });
        applyDelta(reply);
        gotAny = true;
      } else {
        for await (const delta of groqChatStream({
          messages: [{ role: 'system', content: prompt }, ...history, { role: 'user', content: text }],
          signal: controller.signal
        })) {
          gotAny = true;
          applyDelta(delta);
        }
      }
      if (!gotAny) {
        const reply = await groqChat({ messages: [{ role: 'system', content: prompt }, ...history, { role: 'user', content: text }], signal: controller.signal });
        applyDelta(reply);
      }
    } catch (err) {
      const msg = friendlifyError(err);
      setMessages(m => {
        const copy = m.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant' && !last.text) {
          copy[copy.length - 1] = { role: 'assistant', text: msg };
        } else {
          copy.push({ role: 'assistant', text: msg });
        }
        return copy;
      });
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      setBusy(false);
    }
  }, [messages, dataState, maxHistory]);

  const stop = useCallback(() => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch { /* abaikan */ } }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch { /* abaikan */ } }
    busyRef.current = false;
    setBusy(false);
    seedRef.current = false;
    setMessages([]);
  }, []);

  return { messages, send, stop, reset, busy, dataState, hasKey: Boolean(getGroqKey()) };
}