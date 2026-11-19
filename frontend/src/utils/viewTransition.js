/**
 * Shared Element / View Transition Helper (Principle 20)
 *
 * Utilizes the native document.startViewTransition API if available in the browser,
 * with seamless graceful fallback for older browsers.
 *
 * @param {Function} updateCallback - State or DOM update function that triggers the transition
 * @returns {Promise<void>}
 */
export function startViewTransition(updateCallback) {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    return document.startViewTransition(updateCallback);
  }
  // Graceful fallback for non-supporting browsers
  updateCallback();
  return Promise.resolve();
}
