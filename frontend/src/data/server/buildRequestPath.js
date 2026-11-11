/**
 * Request path: turns whatever URL a screen passes in into a clean "/path?query".
 */
export const buildRequestPath = (url, options = {}) => {
  let rawUrl = url ? String(url).trim() : '';

  // Clean up any "undefined/" or "null/" prefix from missing env vars
  if (/^(?:undefined|null)\b/i.test(rawUrl)) {
    rawUrl = rawUrl.replace(/^(?:undefined|null)\/?/i, '/');
  }

  // Extract path and query
  let pathWithQuery = rawUrl;
  if (/^https?:\/\/[^/]+/i.test(pathWithQuery)) {
    pathWithQuery = pathWithQuery.replace(/^https?:\/\/[^/]+/i, '');
  }
  if (!pathWithQuery.startsWith('/')) {
    pathWithQuery = '/' + pathWithQuery;
  }

  // Clean up any consecutive slashes in the path portion (e.g. //classrooms -> /classrooms)
  pathWithQuery = pathWithQuery.replace(/\/+/g, '/');

  // Cache busting for GET requests to prevent stale browser cache
  if (!options.method || options.method.toUpperCase() === 'GET') {
    const sep = pathWithQuery.includes('?') ? '&' : '?';
    pathWithQuery = `${pathWithQuery}${sep}_t=${Date.now()}`;
  }

  return pathWithQuery;
};

