import { _electron as electron } from 'playwright'
import { findLatestBuild, parseElectronApp, } from 'electron-playwright-helpers'

export const launchApp = async () : Promise<{ electronApp, window }> => {
  const latestBuild = findLatestBuild()
  const appInfo = parseElectronApp(latestBuild)
  process.env.CI = 'e2e'
  const electronApp = await electron.launch({
    executablePath: appInfo.executable,
    args: [appInfo.main],
    env: { ...process.env, TEST: '1' }
  })
  electronApp.on('window', async (page) => {
    // capture errors
    page.on('pageerror', (error) => {
      console.error(error)
    })
    // capture console messages
    page.on('console', (msg) => {
      console.log(msg.text())
    })
  })
  const window = await electronApp.firstWindow()
  await window.waitForSelector('.main')
  return { electronApp, window }

}
