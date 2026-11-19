import { getActiveUploadBaseUrl, extractUploadPath } from '../utils/mediaUrl';
import { getLocalApiUrl } from './server/serverUrls';

export async function uploadClassworkFile(file, type) {
  const filename = file.name;
  const cleanFilename = encodeURIComponent(filename);
  const uploadBase = getActiveUploadBaseUrl() || getLocalApiUrl();

  // 1. Direct binary streaming upload
  try {
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    const headers = { 'X-Filename': filename };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `${uploadBase}/upload-raw?filename=${cleanFilename}`,
      { method: 'POST', headers, body: file }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.url || data.path) {
        const canonicalPath = data.path || extractUploadPath(data.url) || data.url;
        const canonicalThumb = data.thumbnailPath || (data.thumbnailUrl ? extractUploadPath(data.thumbnailUrl) : null) || data.thumbnailUrl;
        return { type, name: filename, url: canonicalPath, thumbnailUrl: canonicalThumb };
      }
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

    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${uploadBase}/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ filename, dataUrl })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.url || data.path) {
        const canonicalPath = data.path || extractUploadPath(data.url) || data.url;
        const canonicalThumb = data.thumbnailPath || (data.thumbnailUrl ? extractUploadPath(data.thumbnailUrl) : null) || data.thumbnailUrl;
        return { type, name: filename, url: canonicalPath, thumbnailUrl: canonicalThumb };
      }
    }
  } catch (_) {}

  return { type, name: filename, url: URL.createObjectURL(file) };
}
