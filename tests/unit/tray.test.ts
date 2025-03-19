
import { vi, beforeAll, expect, test, Mock } from 'vitest'
import { app, Menu } from 'electron'
import AutoUpdater from '../../src/main/autoupdate'
import Tray from '../../src/main/tray'

vi.mock('electron', () => {
  const Tray = vi.fn();
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
    Tray,
    Menu,
  }
})

beforeAll(() => {
  // @ts-expect-error mocking
  process.resourcesPath = 'resourcesPath'
})

test('Creates tray', async () => {
  const tray = new Tray(app, new AutoUpdater(app, { onUpdateAvailable: () => {}, preInstall: () => {} }), () => {})
  tray.install()
  expect(tray.tray).toBeDefined()
  expect(Menu.buildFromTemplate).toHaveBeenCalled()
  expect((Menu.buildFromTemplate as Mock).mock.calls[0][0]).toHaveLength(14)
  expect((Menu.buildFromTemplate as Mock).mock.calls[0][0].map((item: any) => item.label)).toEqual([
    'Quick Prompt', 'New Chat', 'Scratchpad', 'Run AI Command', undefined,
    'Design Studio', undefined,
    'Read Aloud', 'Start Dictation', 'Voice Chat', undefined,
    'Settings…', undefined,
    'Quit'
  ]);
  expect(tray.tray.setContextMenu).toHaveBeenCalled()
  expect(tray.tray.on).toHaveBeenCalledTimes(2)
});
