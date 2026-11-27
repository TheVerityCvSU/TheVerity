import { lazy } from 'react';

/**
 * Wraps React.lazy with a short retry on dynamic import failure (e.g., transient
 * Vite dev 504 Outdated Optimize Dep or brief network hiccup).
 */
export function lazyWithRetry(importer, retries = 2, delayMs = 350) {
  return lazy(async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        }
      }
    }
    throw lastError;
  });
}
