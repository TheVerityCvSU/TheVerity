import { extractUploadPath, resolveMediaUrl } from './mediaUrl';

/**
 * Ensures the suggested download filename keeps a sensible extension from the URL if omitted.
 */
function buildDownloadFilename(resolvedUrl, suggestedName) {
  const cleanUrlPath = String(resolvedUrl || '').split('?')[0].split('#')[0];
  let urlBasename = '';
  try {
    urlBasename = decodeURIComponent(cleanUrlPath.split('/').pop() || '').replace(/^\d+_/, '');
  } catch (_) {
    urlBasename = (cleanUrlPath.split('/').pop() || '').replace(/^\d+_/, '');
  }

  let name = String(suggestedName || '').trim() || urlBasename || 'download';
  const urlExtMatch = urlBasename.match(/(\.[a-zA-Z0-9]{1,8})$/);
  const nameHasExt = /\.[a-zA-Z0-9]{1,8}$/.test(name);
  if (!nameHasExt && urlExtMatch) {
    name = `${name}${urlExtMatch[1]}`;
  }
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

/**
 * Triggers a direct file download into the user's Downloads folder without navigating
 * the SPA away or opening a new browser tab.
 *
 * - For Verity `/uploads/` URLs: uses the backend `?download=1&filename=...` endpoint
 *   which sends `Content-Disposition: attachment` (streams large videos/PDFs directly
 *   to disk without loading them into browser memory).
 * - For `blob:`, `data:`, or external CORS-enabled URLs: fetches as Blob and triggers
 *   a same-origin `<a download>` click.
 */
export async function triggerDirectDownload(rawUrl, suggestedName = '') {
  if (!rawUrl) return;
  const resolved = resolveMediaUrl(rawUrl) || String(rawUrl).trim();
  if (!resolved) return;

  const filename = buildDownloadFilename(resolved, suggestedName);

  // 1. blob: or data: URL — already same-origin, <a download> works natively
  if (resolved.startsWith('blob:') || resolved.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = resolved;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 2. Verity-hosted /uploads/ URL — use backend Content-Disposition: attachment
  const uploadPath = extractUploadPath(resolved);
  if (uploadPath) {
    try {
      const targetUrl = new URL(resolved);
      targetUrl.searchParams.set('download', '1');
      targetUrl.searchParams.set('filename', filename);

      // Use a hidden iframe for Content-Disposition: attachment downloads so the SPA
      // never navigates away and Electron/Chrome streams directly to the Downloads folder.
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = targetUrl.toString();
      document.body.appendChild(iframe);
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (_) {}
      }, 60000);
      return;
    } catch (_) {
      // Fall through to Blob fetch below
    }
  }

  // 3. Fallback: fetch as Blob -> local object URL -> <a download>
  try {
    const res = await fetch(resolved, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (_) {
    // Last-resort fallback if third-party host blocks CORS
    const a = document.createElement('a');
    a.href = resolved;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
