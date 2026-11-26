const path = require('path');

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

const GOOGLE_AUTH_EXACT_HOSTS = new Set([
  'accounts.google.com',
  'oauth2.googleapis.com',
  'www.googleapis.com',
  'accounts.youtube.com',
]);

function isPrivateOrLocalHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

function isAllowedExternalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch (_) {
    return false;
  }
}

function isAllowedGoogleAuthUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) return false;

    const host = parsed.hostname.toLowerCase();
    const isGoogleHost =
      GOOGLE_AUTH_EXACT_HOSTS.has(host) ||
      host.endsWith('.accounts.google.com') ||
      ((host === 'google.com' || host === 'www.google.com') && parsed.pathname.startsWith('/gsi/'));

    if (isGoogleHost) {
      return parsed.protocol === 'https:';
    }

    const isTrustedAppOrigin =
      isPrivateOrLocalHostname(host) || host === 'verity-2z4v.onrender.com';

    if (isTrustedAppOrigin && (parsed.pathname.startsWith('/auth/google') || parsed.pathname.startsWith('/google-login'))) {
      return parsed.protocol === 'https:' || isPrivateOrLocalHostname(host);
    }

    return false;
  } catch (_) {
    return false;
  }
}

function isAuthorizedIpcSender(event) {
  const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || '';
  if (!senderUrl) return false;
  if (senderUrl === 'about:blank' || senderUrl.startsWith('file://')) return true;
  try {
    const parsed = new URL(senderUrl);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) return false;
    return isPrivateOrLocalHostname(parsed.hostname);
  } catch (_) {
    return false;
  }
}

function resolveSafeDistFile(distDir, reqPathname) {
  const distRoot = path.resolve(distDir);
  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(String(reqPathname || '/'));
  } catch (_) {
    return { safe: false, filePath: path.join(distRoot, 'index.html') };
  }

  // Strip null bytes and normalize leading slashes so path.resolve stays relative
  const cleaned = decodedPath.replace(/\0/g, '').replace(/^[/\\]+/, '');
  const candidate = cleaned ? path.resolve(distRoot, cleaned) : path.join(distRoot, 'index.html');

  const isInsideDist =
    candidate === distRoot ||
    candidate.startsWith(distRoot + path.sep);

  if (!isInsideDist) {
    return { safe: false, filePath: path.join(distRoot, 'index.html') };
  }

  return { safe: true, filePath: candidate };
}

module.exports = {
  isAllowedExternalUrl,
  isAllowedGoogleAuthUrl,
  isAuthorizedIpcSender,
  resolveSafeDistFile,
};
