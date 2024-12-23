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

test('Prompt', async () => {
  await window.fill('.prompt .input textarea', 'Hello World')
  await window.click('.prompt .icon.send')
  await window.waitForSelector('.content .messages')
  await expect(window.isVisible('.content .messages')).resolves.toBeTruthy()
  await expect(window.isVisible('.content .messages .message')).resolves.toBeTruthy()
  await expect(window.locator('.content .messages .message').all()).resolves.toHaveLength(2)
  await window.waitForSelector('.prompt .icon.send')
})
