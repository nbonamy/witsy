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
  await expect(window.isVisible('.main')).resolves.toBeTruthy()
  await expect(window.isVisible('.main .sidebar')).resolves.toBeTruthy()
  await expect(window.isVisible('.main .resizer')).resolves.toBeTruthy()
  await expect(window.isVisible('.main .content')).resolves.toBeTruthy()
})

test('Check sidebar', async () => {
  await expect(window.isVisible('.sidebar .toolbar')).resolves.toBeTruthy()
  await expect(window.isVisible('.sidebar .chats')).resolves.toBeTruthy()
  await expect(window.isVisible('.sidebar .footer')).resolves.toBeTruthy()
  await expect(window.isVisible('.sidebar .footer #open-settings')).resolves.toBeTruthy()
})

test('Check content', async () => {
  await expect(window.isVisible('.content .toolbar')).resolves.toBeTruthy()
  await expect(window.isVisible('.content .empty') || window.isVisible('.content .messages')).resolves.toBeTruthy()
  await expect(window.isVisible('.content .prompt')).resolves.toBeTruthy()
})

test('Open settings', async () => {
  await window.click('.sidebar .footer span')
  await window.waitForSelector('.settings')
  await expect(window.isVisible('.settings')).resolves.toBeTruthy()
})
