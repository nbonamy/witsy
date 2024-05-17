
import { vi, expect, test, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { BrowserWindow } from 'electron'
import Monitor from '../../src/main/monitor'
import { wait } from '../../src/main/utils'
import path from 'path'
import fs from 'fs'
import os from 'os'

vi.mock('electron', async () => {
  const BrowserWindow = vi.fn()
  BrowserWindow.prototype.isDestroyed = vi.fn(function() { return false })
  BrowserWindow.getAllWindows = vi.fn(() => [ new BrowserWindow(), new BrowserWindow(), new Monitor('test') ])
  BrowserWindow.prototype.webContents = {
    send: vi.fn(),
  }
  return {
    BrowserWindow,
  }
})

let monitor: Monitor = null
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
  monitor.stop()
})

test('Start monitor', async () => {
  monitor = new Monitor('test')
  monitor.start(tempFile)
  expect(monitor.size()).toBe(5)
})

test('Stop monitor', async () => {
  monitor = new Monitor('test')
  monitor.start(tempFile)
  monitor.stop()
  expect(monitor.size()).toBe(0)
})

test('Notify monitor', async () => {
  monitor = new Monitor('test', 50)
  monitor.start(tempFile)
  fs.appendFileSync(tempFile, ' World')
  await wait(150)
  expect(BrowserWindow.getAllWindows).toHaveBeenCalledTimes(1)
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenCalledTimes(2)
})

test('Notify after stop', async () => {
  monitor = new Monitor('test', 500)
  monitor.start(tempFile)
  monitor.stop()
  fs.appendFileSync(tempFile, ' World')
  await wait(150)
  expect(BrowserWindow.getAllWindows).toHaveBeenCalledTimes(0)
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenCalledTimes(0)
})
