import { vi, beforeEach, expect, test, describe } from 'vitest'
import { app, dialog } from 'electron'
import * as backup from '../../src/main/backup'
import * as file from '../../src/main/file'
import * as config from '../../src/main/config'
import * as commands from '../../src/main/commands'
import defaultSettings from '../../defaults/settings.json'
import fs from 'fs'
import archiver from 'archiver'
import extractZip from 'extract-zip'

// Mock all dependencies
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userdata'),
    getLocale: vi.fn(() => 'en-US'),
  },
  dialog: {
    showMessageBox: vi.fn()
  }
}))

vi.mock('../../src/main/file', () => ({
  pickDirectory: vi.fn(),
  pickFile: vi.fn()
}))

vi.mock('../../src/main/config', () => ({
  settingsFilePath: vi.fn(() => '/mock/userdata/settings.json'),
  loadSettings: vi.fn(() => defaultSettings),
}))

vi.mock('../../src/main/history', () => ({
  historyFilePath: vi.fn(() => '/mock/userdata/history.json')
}))

vi.mock('../../src/main/experts', () => ({
  expertsFilePath: vi.fn(() => '/mock/userdata/experts.json')
}))

vi.mock('../../src/main/commands', () => ({
  commandsFilePath: vi.fn(() => '/mock/userdata/commands.json')
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    createWriteStream: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    renameSync: vi.fn(),
    readdirSync: vi.fn((path, opts) => 
      opts?.withFileTypes ? [ { name: 'file1.jpg', isDirectory: () => false }, { name: 'file2.png', isDirectory: () => false } ] : [ 'file1.jpg', 'file2.png' ]),
    rmSync: vi.fn()
  }
}))

vi.mock('archiver', () => ({
  default: vi.fn()
}))

vi.mock('extract-zip', () => ({
  default: vi.fn()
}))

describe('Backup functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportBackup', () => {
    test('should return false when no directory selected', async () => {
      vi.mocked(file.pickDirectory).mockReturnValue(null)

      const result = await backup.exportBackup(app)

      expect(result).toBe(false)
      expect(file.pickDirectory).toHaveBeenCalledWith(app)
    })

    test('should call all filepath functions', async () => {
      vi.mocked(file.pickDirectory).mockReturnValue('/mock/export/dir')
      
      const mockArchive = {
        on: vi.fn(),
        pipe: vi.fn(),
        file: vi.fn(),
        directory: vi.fn(),
        finalize: vi.fn(),
        pointer: vi.fn(() => 1024)
      }
      
      vi.mocked(archiver).mockReturnValue(mockArchive as any)
      
      const mockOutput = {
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(callback, 10)
          }
        })
      }
      
      vi.mocked(fs.createWriteStream).mockReturnValue(mockOutput as any)

      const result = await backup.exportBackup(app)

      expect(result).toBe(true)
      expect(config.settingsFilePath).toHaveBeenCalledWith(app)
      // expect(history.historyFilePath).toHaveBeenCalledWith(app)
      // expect(experts.expertsFilePath).toHaveBeenCalledWith(app)
      expect(commands.commandsFilePath).toHaveBeenCalledWith(app)
      expect(mockArchive.file).toHaveBeenCalledTimes(2)
      expect(mockArchive.finalize).toHaveBeenCalled()
    })

    test('should handle general errors gracefully', async () => {
      vi.mocked(file.pickDirectory).mockReturnValue('/mock/export/dir')
      
      // Mock archiver to throw an error
      vi.mocked(archiver).mockImplementation(() => {
        throw new Error('Archiver creation failed')
      })

      const result = await backup.exportBackup(app)

      expect(result).toBe(false)
    })
  })

  describe('importBackup', () => {

    test('should return false when user cancels confirmation', async () => {
      vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0 } as any)
      const result = await backup.importBackup(app, vi.fn())
      expect(result).toBe(false)
      expect(dialog.showMessageBox).toHaveBeenCalled()
      expect(file.pickFile).not.toHaveBeenCalled()
    })

    test('should return false when no backup file selected', async () => {
      vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1 } as any)
      vi.mocked(file.pickFile).mockReturnValue(null)
      const result = await backup.importBackup(app, vi.fn())
      expect(result).toBe(false)
      expect(file.pickFile).toHaveBeenCalledWith(app, {
        location: true,
        filters: [{ name: 'Backup files', extensions: ['zip'] }]
      })
    })

    test('should call extractZip with correct parameters', async () => {
      vi.mocked(dialog.showMessageBox)
        .mockResolvedValueOnce({ response: 1 } as any)
        .mockResolvedValueOnce({ response: 0 } as any)
      vi.mocked(file.pickFile).mockReturnValue('/mock/backup.zip')
      vi.mocked(extractZip).mockResolvedValue(undefined)

      const result = await backup.importBackup(app, vi.fn())

      expect(result).toBe(true)
      expect(extractZip).toHaveBeenCalledWith('/mock/backup.zip', {
        dir: expect.stringContaining('witsy-restore-')
      })
    })

    test('should handle extraction errors', async () => {
      vi.mocked(dialog.showMessageBox)
        .mockResolvedValueOnce({ response: 1 } as any)
        .mockResolvedValueOnce({ response: 0 } as any)
      vi.mocked(file.pickFile).mockReturnValue('/mock/backup.zip')
      vi.mocked(extractZip).mockRejectedValue(new Error('Extraction failed'))

      const result = await backup.importBackup(app, vi.fn())

      expect(result).toBe(false)
      expect(dialog.showMessageBox).toHaveBeenNthCalledWith(2, {
        type: 'error',
        title: 'Restore Failed',
        message: 'Failed to restore settings from backup.',
        detail: 'Error: Extraction failed',
        buttons: ['OK']
      })
    })

    test('should use filepath functions for restoration', async () => {
      vi.mocked(dialog.showMessageBox)
        .mockResolvedValueOnce({ response: 1 } as any)
        .mockResolvedValueOnce({ response: 0 } as any)
      vi.mocked(file.pickFile).mockReturnValue('/mock/backup.zip')
      vi.mocked(extractZip).mockResolvedValue(undefined)

      const result = await backup.importBackup(app, vi.fn())

      expect(result).toBe(true)
      expect(config.settingsFilePath).toHaveBeenCalledWith(app)
      // expect(history.historyFilePath).toHaveBeenCalledWith(app)
      // expect(experts.expertsFilePath).toHaveBeenCalledWith(app)
      expect(commands.commandsFilePath).toHaveBeenCalledWith(app)
    })

    test('should clean up temporary directory', async () => {
      vi.mocked(dialog.showMessageBox)
        .mockResolvedValueOnce({ response: 1 } as any)
        .mockResolvedValueOnce({ response: 0 } as any)
      vi.mocked(file.pickFile).mockReturnValue('/mock/backup.zip')
      vi.mocked(extractZip).mockResolvedValue(undefined)

      const result = await backup.importBackup(app, vi.fn())

      expect(result).toBe(true)
      expect(fs.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('witsy-restore-'),
        { recursive: true, force: true }
      )
    })

    test('should restart app', async () => {
      const mockQuitApp = vi.fn()
      const mockRelaunch = vi.fn()
      vi.mocked(app).relaunch = mockRelaunch
      
      vi.mocked(dialog.showMessageBox)
        .mockResolvedValueOnce({ response: 1 } as any)
        .mockResolvedValueOnce({ response: 0 } as any)
      vi.mocked(file.pickFile).mockReturnValue('/mock/backup.zip')
      vi.mocked(extractZip).mockResolvedValue(undefined)

      const result = await backup.importBackup(app, mockQuitApp)

      expect(result).toBe(true)
      expect(mockRelaunch).toHaveBeenCalled()
      expect(mockQuitApp).toHaveBeenCalled()
    })

  })
})