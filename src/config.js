export const APP_NAME = 'Smart Kost';
export const AUTHOR_NAME = 'Dian Arya Pratama';
export const COPYRIGHT_YEAR = 2026;

export const ABOUT_TEXT = 'Smart Kost adalah dashboard manajemen jaringan internet (WiFi hotspot) untuk kost. Aplikasi ini memantau pemakaian data tiap kamar, mengelola batas FUP per ISP, menampilkan tren pemakaian harian, serta menyediakan akses aman melalui kata sandi dan login wajah. Dilengkapi Asisten AI berbasis Groq untuk menanya data dan analitik secara langsung.';

export const STACK = [
  'React 19',
  'Vite',
  'Tailwind CSS',
  'Recharts',
  'lucide-react',
  'face-api.js',
  'PapaParse',
  'Groq AI (LLM & Whisper)',
  'Google Sheets',
  'Google Apps Script',
  'Vercel'
];

export const FAQS = [
  { q: 'Apa itu Smart Kost?', a: 'Aplikasi dashboard untuk memantau pemakaian internet (WiFi hotspot) per kamar kost secara real-time, lengkap dengan manajemen FUP ISP, tren pemakaian, dan laporan.' },
  { q: 'Dari mana data dashboard dimuat?', a: 'Data dibaca dari Google Sheets (publish ke CSV) dan diperbarui lewat Google Apps Script untuk aksi simpan, reset, dan wajah.' },
  { q: 'Mengapa ada login wajah?', a: 'Untuk keamanan ekstra akses administrator. Wajah didaftarkan dari dashboard, lalu dicocokkan saat login.' },
  { q: 'Apa itu FUP?', a: 'Fair Usage Policy — batas pemakaian internet per ISP. Dashboard memperingatkan kamar yang mendekati batas.' },
  { q: 'Bagaimana asisten AI bekerja?', a: 'Asisten memakai model Groq (gpt-oss-120b) untuk jawaban dan Whisper untuk transkripsi suara, dengan konteks analitik dashboard.' },
  { q: 'Siapa pembuat aplikasi ini?', a: 'Smart Kost dibuat oleh Dian Arya Pratama dan dilindungi hak cipta © 2026.' }
];

// --- GANTI DENGAN URL CSV ANDA ---
export const HOTSPOT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwYILZrPnVQUL19TMIDLnVbVcW_a0LTGxvvb2bJepITRGF5Ldk2joGEjHoJLULKTny63zrcB18r6Hp/pub?gid=123456&single=true&output=csv";
export const ADMIN_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwYILZrPnVQUL19TMIDLnVbVcW_a0LTGxvvb2bJepITRGF5Ldk2joGEjHoJLULKTny63zrcB18r6Hp/pub?gid=1794162175&single=true&output=csv";

// Nilai kuota: kategori pemakaian untuk fitur Cek Kuota publik
// Normal: <= rata-rata · Waspada: sampai 2x rata-rata · Tidak Normal: > 2x rata-rata
export const QUOTA_WASPADA_FACTOR = 2.0;
export const KUOTA_CATEGORIES = {
  normal: { label: 'Normal', color: 'emerald' },
  waspada: { label: 'Waspada', color: 'amber' },
  abnormal: { label: 'Tidak Normal', color: 'red' }
};