import { ElectronApplication, Page, _electron as electron } from 'playwright'
import { beforeAll, afterAll, expect, test } from 'vitest'

let electronApp: ElectronApplication
let window: Page

beforeAll(async () => {
  electronApp = await electron.launch({
    args: ['.'],
    env: { ...process.env, TEST: '1' }
  })
  window = await electronApp.firstWindow()
})

afterAll(async () => {
  await electronApp.close()
})

test('Start application', async () => {
  const appName = await electronApp.evaluate(async ({ app }) => app.getName())
  const isReady = await electronApp.evaluate(async ({ app }) => app.isReady())
  expect(isReady).toBeTruthy()
  expect(appName).toBe('WittyAI')
})

test('Open settings', async () => {
  await window.click('.sidebar .footer span')
  await window.waitForSelector('.settings')
  expect(window.isVisible('.settings')).resolves.toBeTruthy()
})
