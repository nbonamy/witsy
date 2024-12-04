import { ElectronApplication, Page } from 'playwright'
import { beforeAll, afterAll, expect, test } from 'vitest'
import { launchApp } from './e2e'

let electronApp: ElectronApplication
let window: Page

beforeAll(async () => {
  ({ electronApp, window } = await launchApp())
})

afterAll(async () => {
  await electronApp.close()
})

test('Start application', async () => {
  const appName = await electronApp.evaluate(async ({ app }) => app.getName())
  const isReady = await electronApp.evaluate(async ({ app }) => app.isReady())
  expect(isReady).toBeTruthy()
  expect(appName).toBe('Witsy')
})

test('Check components', async () => {
  expect(window.isVisible('.main')).resolves.toBeTruthy()
  expect(window.isVisible('.main .sidebar')).resolves.toBeTruthy()
  expect(window.isVisible('.main .resizer')).resolves.toBeTruthy()
  expect(window.isVisible('.main .content')).resolves.toBeTruthy()
})

test('Check sidebar', async () => {
  expect(window.isVisible('.sidebar .toolbar')).resolves.toBeTruthy()
  expect(window.isVisible('.sidebar .chats')).resolves.toBeTruthy()
  expect(window.isVisible('.sidebar .footer')).resolves.toBeTruthy()
  expect(window.isVisible('.sidebar .footer #open-settings')).resolves.toBeTruthy()
})

test('Check content', async () => {
  expect(window.isVisible('.content .toolbar')).resolves.toBeTruthy()
  expect(window.isVisible('.content .empty') || window.isVisible('.content .messages')).resolves.toBeTruthy()
  expect(window.isVisible('.content .prompt')).resolves.toBeTruthy()
})

test('Open settings', async () => {
  await window.click('.sidebar .footer span')
  await window.waitForSelector('.settings')
  expect(window.isVisible('.settings')).resolves.toBeTruthy()
})
