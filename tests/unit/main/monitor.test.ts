
import { vi, expect, test, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import Monitor from '@main/monitor'
import path from 'path'
import fs from 'fs'
import os from 'os'

let monitor: Monitor|null = null
const callback = vi.fn()
const tempFile = path.join(os.tmpdir(), 'vitest')

beforeAll(async () => {
  fs.writeFileSync(tempFile, 'Hello')
})

afterAll(async () => {
  try {
    fs.unlinkSync(tempFile)
  } catch (error) {
    console.error(error)
  }
})

beforeEach(async () => {
  vi.clearAllMocks()
})

afterEach(async () => {
  monitor!.stop()
})

test('Start monitor', async () => {
  monitor = new Monitor(callback)
  monitor.start(tempFile)
  expect(monitor.calculateDigest()).toBe('8b1a9953c4611296a827abf8c47804d7')
})

test('Stop monitor', async () => {
  monitor = new Monitor(callback)
  monitor.start(tempFile)
  monitor.stop()
  expect(monitor.calculateDigest()).toBe('')
})

test('Notify monitor', async () => {
  monitor = new Monitor(callback)
  monitor.start(tempFile)
  // Small delay to ensure watcher is ready
  await new Promise(resolve => setTimeout(resolve, 100))
  fs.appendFileSync(tempFile, ' World')
  await vi.waitUntil(() => callback.mock.calls.length > 0, { timeout: 500 })
})

test('Notify after stop', async () => {
  monitor = new Monitor(callback)
  monitor.start(tempFile)
  monitor.stop()
  // Small delay to ensure watcher is stopped
  await new Promise(resolve => setTimeout(resolve, 100))
  fs.appendFileSync(tempFile, ' World')
  // Wait a bit to verify no callback is triggered
  await new Promise(resolve => setTimeout(resolve, 200))
  expect(callback).toHaveBeenCalledTimes(0)
})
