import * as faceapi from 'face-api.js';

// Model dimuat dari /models (hasil salinan folder public/models saat build)
const MODEL_URL = '/models';

export const FACE_THRESHOLD = 0.55; // default face-api 0.6; 0.55 lebih selektif
export const DESCRIPTOR_LENGTH = 128;

let modelsPromise = null;

// Muat sekali saja, hasilnya dipakai ulang
export function loadFaceModels() {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
  }
  return modelsPromise;
}

export async function openCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Browser tidak mendukung akses kamera.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* track sudah berhenti */ }
  });
}

// Kembalikan 128 angka, atau null kalau tidak ada wajah terdeteksi
export async function detectDescriptor(video) {
  if (!video || video.videoWidth === 0) throw new Error('Kamera belum siap.');
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
  const detected = await faceapi
    .detectSingleFace(video, options)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detected) return null;
  return Array.from(detected.descriptor);
}

export function distance(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = Number(a[i]) - Number(b[i]);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// candidates: [{ username, faceDescriptor: [128 angka] }]
export function matchFace(descriptor, candidates, threshold = FACE_THRESHOLD) {
  if (!descriptor || !Array.isArray(candidates) || candidates.length === 0) return null;
  let best = null;
  candidates.forEach((candidate) => {
    const d = distance(descriptor, candidate.faceDescriptor);
    if (!best || d < best.distance) {
      best = { username: candidate.username, distance: d };
    }
  });
  if (!best || best.distance > threshold) return null;
  return best;
}

export function serializeDescriptor(descriptor) {
  return JSON.stringify((descriptor || []).map((n) => Number(n)));
}

// Menerima: JSON array, "0.1;0.2;...", "0.1,0.2,..." atau Float32Array -> {data: [...]}
export function parseDescriptor(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;

  let values = null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) values = parsed;
    else if (parsed && Array.isArray(parsed.data)) values = parsed.data;
    else if (parsed && Array.isArray(parsed.values)) values = parsed.values;
  } catch {
    values = null;
  }

  if (!values) values = text.split(/[;,\s]+/).filter(Boolean);

  const numbers = values.map(Number).filter((n) => Number.isFinite(n));
  if (numbers.length !== DESCRIPTOR_LENGTH) return null;
  return numbers;
}
