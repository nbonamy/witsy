
import { vi, expect, test, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import Monitor from '../../../src/main/monitor'
import { wait } from '../../../src/main/utils'
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
  await wait(1000)
  fs.appendFileSync(tempFile, ' World')
  await vi.waitUntil(() => callback.mock.calls.length > 0)
})

test('Notify after stop', async () => {
  monitor = new Monitor(callback)
  monitor.start(tempFile)
  monitor.stop()
  await wait(1000)
  fs.appendFileSync(tempFile, ' World')
  await wait(1000)
  expect(callback).toHaveBeenCalledTimes(0)
})
