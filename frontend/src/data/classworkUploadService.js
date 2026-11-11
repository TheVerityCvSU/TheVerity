import { apiFetch } from './api';

export async function uploadClassworkFile(file, type) {
  const filename = file.name;
  const cleanFilename = encodeURIComponent(filename);

  // 1. Direct binary streaming upload
  try {
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    const headers = { 'X-Filename': filename };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/upload-raw?filename=${cleanFilename}`,
      { method: 'POST', headers, body: file }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.url) return { type, name: filename, url: data.url };
    }
  } catch (_) {}

  // 2. Base64 fallback
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, dataUrl })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.url) return { type, name: filename, url: data.url };
    }
  } catch (_) {}

  return { type, name: filename, url: URL.createObjectURL(file) };
}
