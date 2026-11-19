/**
 * Optimistic Updates Utility (Principle 16)
 *
 * Immediately updates the UI on user action before awaiting server response,
 * rolling back to the previous snapshot only if the promise rejects or fails.
 *
 * @param {Function} applyOptimistic - Synchronous state setter that applies the new state immediately
 * @param {Function} serverAction - Async function executing the network request
 * @param {Function} rollback - Function to restore previous state on network/server error
 * @param {Function} [onError] - Optional callback to handle error notification
 * @returns {Promise<any>}
 */
export async function executeOptimisticUpdate({
  applyOptimistic,
  serverAction,
  rollback,
  onError = (err) => console.error('Optimistic update failed, rolled back:', err)
}) {
  try {
    // 1. Immediately apply optimistic UI change
    applyOptimistic();
  } catch (syncErr) {
    console.error('Error applying optimistic state:', syncErr);
  }

  try {
    // 2. Perform background server action
    const result = await serverAction();
    return result;
  } catch (error) {
    // 3. Rollback immediately if server request fails
    try {
      rollback(error);
    } catch (rollbackErr) {
      console.error('Error during optimistic rollback:', rollbackErr);
    }
    if (typeof onError === 'function') {
      onError(error);
    }
    throw error;
  }
}
