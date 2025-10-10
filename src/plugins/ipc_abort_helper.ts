/**
 * IPC Abort Helper - Witsy-specific utility for plugin IPC calls with abort support
 *
 * This helper bridges the gap between in-process AbortSignals and cross-process IPC calls
 * by generating unique signal IDs and providing cancel methods.
 */

/**
 * Execute an IPC operation with abort signal support
 *
 * @param operation - The IPC operation to execute (receives signalId)
 * @param cancelMethod - The IPC cancel method to call on abort
 * @param abortSignal - Optional abort signal to monitor
 * @param onAbort - Optional cleanup callback
 * @returns Promise that resolves with operation result or rejects on abort
 *
 * @example
 * // In a plugin execute method:
 * return executeIpcWithAbort(
 *   (signalId) => window.api.search.query(query, num, signalId),
 *   (signalId) => window.api.search.cancel(signalId),
 *   context.abortSignal
 * )
 */
export async function executeIpcWithAbort<T>(
  operation: (signalId: string) => Promise<T>,
  cancelMethod: (signalId: string) => void,
  abortSignal?: AbortSignal,
  onAbort?: () => void
): Promise<T> {

  // Check if already aborted before starting
  if (abortSignal?.aborted) {
    onAbort?.()
    throw new Error('Operation cancelled')
  }

  // If no abort signal, just execute normally
  if (!abortSignal) {
    return operation('')
  }

  // Generate unique signal ID for this operation
  const signalId = crypto.randomUUID()

  // Set up abort listener to call IPC cancel method
  abortSignal.addEventListener('abort', () => {
    onAbort?.()
    cancelMethod(signalId)
  }, { once: true })

  try {
    // Execute operation with signal ID
    return await operation(signalId)
  } catch (error) {
    // Check if this was an abort
    if (abortSignal.aborted) {
      throw new Error('Operation cancelled')
    }
    // Otherwise rethrow original error
    throw error
  }
}
