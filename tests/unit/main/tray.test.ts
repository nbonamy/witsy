
import { vi, beforeAll, expect, test, Mock } from 'vitest'
import { app, Menu } from 'electron'
import AutoUpdater from '@main/autoupdate'
import Tray from '@main/tray'

vi.mock('electron', () => {
  const Tray = vi.fn();
  Tray.prototype.setImage = vi.fn();
  Tray.prototype.setContextMenu = vi.fn();
  Tray.prototype.on = vi.fn();
  const Menu = {
    buildFromTemplate: vi.fn(() => {}),
  }
  //Tray.prototype.show = vi.fn();
  return {
    app: {
      getLocale: vi.fn(() => 'en-US'),
      getVersion: vi.fn(() => '1.0.0'),
      getPath: vi.fn(() => ''),
    },
    autoUpdater: {
      setFeedURL: vi.fn(),
      checkForUpdates: vi.fn(),
      on: vi.fn(),
    },
    nativeImage: {
      createFromPath: vi.fn(() => {
        return {
          setTemplateImage: vi.fn(),
        }
      }),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((data) => `encrypted-${data}`),
      decryptString: vi.fn((data) => data.toString('latin1'))
    },
    Tray,
    Menu,
  }
})

vi.mock('@main/i18n', () => ({
  useI18n: vi.fn(() => (key: string) => key)
}))

beforeAll(() => {
  // @ts-expect-error mocking
  process.resourcesPath = 'resourcesPath'
})

test('Creates tray', async () => {
  const tray = new Tray(app, new AutoUpdater(app, { onUpdateAvailable: () => {}, preInstall: () => {} }), () => {})
  tray.install()
  expect(tray.tray).toBeDefined()
  expect(Menu.buildFromTemplate).toHaveBeenCalled()
  expect((Menu.buildFromTemplate as Mock).mock.calls[0][0]).toHaveLength(15)
  expect((Menu.buildFromTemplate as Mock).mock.calls[0][0].map((item: any) => item.label)).toEqual([
    'tray.menu.mainWindow', 'tray.menu.quickPrompt', 'tray.menu.runAiCommand', undefined,
    'tray.menu.scratchpad', 'tray.menu.designStudio', undefined,
    'tray.menu.readAloud', 'tray.menu.startDictation', 'tray.menu.audioBooth', 'tray.menu.voiceMode', undefined,
    'tray.menu.settings', undefined,
    // 'tray.menu.httpServer', undefined,
    'tray.menu.quit'
  ]);
  expect(tray.tray.setContextMenu).toHaveBeenCalled()
  expect(tray.tray.on).toHaveBeenCalledTimes(2)
});
