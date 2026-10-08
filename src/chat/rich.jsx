// Render teks jawaban AI: bold, italic, kode inline, heading, list, blok kode, tautan.
// Ringan tanpa dependensi eksternal.

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function Inline({ text }) {
  const parts = text.split(INLINE);
  const nodes = parts.map((part, i) => {
    if (!part) return null;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-extrabold text-inherit">{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part)) return <code key={i} className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[0.9em] font-mono">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const url = /^https?:\/\//.test(link[2]) ? link[2] : `https://${link[2]}`;
      return <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">{link[1]}</a>;
    }
    return part;
  });
  return <>{nodes}</>;
}

function CodeBlock({ code }) {
  return (
    <pre className="my-2 overflow-x-auto rounded-xl bg-slate-900 dark:bg-slate-800 p-3 text-[12.5px] leading-relaxed text-slate-100 font-mono">
      {code.replace(/\n$/, '')}
    </pre>
  );
}

export default function RichText({ text }) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i += 1; }
      blocks.push({ type: 'code', text: buf.join('\n') });
      i += 1;
    } else if (/^#{1,3}\s/.test(line.trim())) {
      blocks.push({ type: 'h', text: line.replace(/^#{1,3}\s*/, '') });
      i += 1;
    } else if (/^\s*[-*]\s+/.test(line.trim())) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items: buf });
    } else if (/^\s*\d+[.)]\s+/.test(line.trim())) {
      const buf = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^\s*\d+[.)]\s*/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items: buf });
    } else {
      const buf = [];
      while (i < lines.length && lines[i].trim() !== '') {
        const t = lines[i].trim();
        if (/^\s*[-*]\s+/.test(t) || /^#{1,3}\s/.test(t)) break;
        buf.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'p', text: buf.join(' ') });
      while (i < lines.length && lines[i].trim() === '') i += 1;
    }
  }

  return (
    <div className="space-y-2">
      {blocks.map((b, idx) => {
        if (b.type === 'p') return <p key={idx} className="leading-relaxed"><Inline text={b.text} /></p>;
        if (b.type === 'h') return <h3 key={idx} className="pt-1 text-[15px] font-extrabold text-inherit"><Inline text={b.text} /></h3>;
        if (b.type === 'code') return <CodeBlock key={idx} code={b.text} />;
        if (b.type === 'ul') return (
          <ul key={idx} className="list-disc space-y-1 pl-5 marker:text-slate-400">
            {b.items.map((it, j) => <li key={j} className="leading-relaxed"><Inline text={it} /></li>)}
          </ul>
        );
        if (b.type === 'ol') return (
          <ol key={idx} className="list-decimal space-y-1 pl-5 marker:text-slate-400">
            {b.items.map((it, j) => <li key={j} className="leading-relaxed"><Inline text={it} /></li>)}
          </ol>
        );
        return null;
      })}
    </div>
  );
}