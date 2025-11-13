import { vi, expect, test, beforeEach } from 'vitest'
import { executeIpcWithAbort } from '../../src/renderer/services/plugins/ipc_abort_helper'

// Mock window.api
global.window = {
  api: {}
} as any

beforeEach(() => {
  vi.clearAllMocks()
})

test('executeIpcWithAbort() with no signal', async () => {
  const operation = vi.fn().mockResolvedValue('success')
  const cancel = vi.fn()

  const result = await executeIpcWithAbort(operation, cancel)

  expect(result).toBe('success')
  expect(operation).toHaveBeenCalledWith('')
  expect(cancel).not.toHaveBeenCalled()
})

test('executeIpcWithAbort() with non-aborted signal', async () => {
  const operation = vi.fn().mockResolvedValue('success')
  const cancel = vi.fn()
  const abortController = new AbortController()

  const result = await executeIpcWithAbort(
    operation,
    cancel,
    abortController.signal
  )

  expect(result).toBe('success')
  expect(operation).toHaveBeenCalledWith(expect.any(String))
  expect(cancel).not.toHaveBeenCalled()
})

test('executeIpcWithAbort() with already aborted signal', async () => {
  const operation = vi.fn().mockResolvedValue('success')
  const cancel = vi.fn()
  const abortController = new AbortController()
  abortController.abort()

  await expect(
    executeIpcWithAbort(operation, cancel, abortController.signal)
  ).rejects.toThrow('Operation cancelled')

  expect(operation).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
})

test('executeIpcWithAbort() abort during execution', async () => {
  const abortController = new AbortController()
  const cancel = vi.fn()

  // Create a promise that simulates IPC rejection on abort
  const operation = vi.fn().mockImplementation(() => {
    return new Promise((resolve, reject) => {
      // Simulate IPC that rejects when canceled
      const checkAbort = setInterval(() => {
        if (abortController.signal.aborted) {
          clearInterval(checkAbort)
          reject(new Error('IPC aborted'))
        }
      }, 5)

      setTimeout(() => {
        clearInterval(checkAbort)
        resolve('success')
      }, 100)
    })
  })

  // Abort after 10ms
  setTimeout(() => abortController.abort(), 10)

  await expect(
    executeIpcWithAbort(operation, cancel, abortController.signal)
  ).rejects.toThrow('Operation cancelled')

  // Cancel should be called with the signalId
  expect(cancel).toHaveBeenCalledWith(expect.any(String))
})

test('executeIpcWithAbort() with cleanup callback', async () => {
  const operation = vi.fn().mockResolvedValue('success')
  const cancel = vi.fn()
  const cleanup = vi.fn()
  const abortController = new AbortController()

  abortController.abort()

  await expect(
    executeIpcWithAbort(operation, cancel, abortController.signal, cleanup)
  ).rejects.toThrow('Operation cancelled')

  expect(cleanup).toHaveBeenCalled()
  expect(operation).not.toHaveBeenCalled()
})

test('executeIpcWithAbort() generates unique signal IDs', async () => {
  const abortController = new AbortController()
  const signalIds: string[] = []

  const operation = vi.fn().mockImplementation((signalId: string) => {
    signalIds.push(signalId)
    return Promise.resolve('success')
  })
  const cancel = vi.fn()

  await executeIpcWithAbort(operation, cancel, abortController.signal)
  await executeIpcWithAbort(operation, cancel, abortController.signal)
  await executeIpcWithAbort(operation, cancel, abortController.signal)

  // All signal IDs should be unique
  expect(signalIds).toHaveLength(3)
  expect(new Set(signalIds).size).toBe(3)
})

test('executeIpcWithAbort() calls cancel with correct signalId', async () => {
  const abortController = new AbortController()
  let capturedSignalId: string | null = null

  const operation = vi.fn().mockImplementation((signalId: string) => {
    capturedSignalId = signalId
    return new Promise((resolve, reject) => {
      // Simulate IPC that rejects when canceled
      const checkAbort = setInterval(() => {
        if (abortController.signal.aborted) {
          clearInterval(checkAbort)
          reject(new Error('IPC aborted'))
        }
      }, 5)

      setTimeout(() => {
        clearInterval(checkAbort)
        resolve('success')
      }, 100)
    })
  })

  const cancel = vi.fn()

  // Abort after 10ms
  setTimeout(() => abortController.abort(), 10)

  await expect(
    executeIpcWithAbort(operation, cancel, abortController.signal)
  ).rejects.toThrow('Operation cancelled')

  // Cancel should be called with the same signalId that was passed to operation
  expect(cancel).toHaveBeenCalledWith(capturedSignalId)
})

test('executeIpcWithAbort() rethrows non-abort errors', async () => {
  const operation = vi.fn().mockRejectedValue(new Error('Network error'))
  const cancel = vi.fn()
  const abortController = new AbortController()

  await expect(
    executeIpcWithAbort(operation, cancel, abortController.signal)
  ).rejects.toThrow('Network error')

  expect(cancel).not.toHaveBeenCalled()
})

test('executeIpcWithAbort() converts errors to canceled when aborted', async () => {
  const abortController = new AbortController()

  const operation = vi.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('IPC failed')), 100)
    })
  })

  const cancel = vi.fn()

  // Abort immediately
  abortController.abort()

  // Even though operation might reject with 'IPC failed',
  // we should get 'Operation cancelled' because signal is aborted
  await expect(
    executeIpcWithAbort(operation, cancel, abortController.signal)
  ).rejects.toThrow('Operation cancelled')
})
