
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { shell, systemPreferences } from 'electron'
import MacOSPermissions from '../../src/main/permissions'

// Mock electron modules
vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn()
  },
  systemPreferences: {
    isTrustedAccessibilityClient: vi.fn()
  }
}))

vi.mock('child_process')

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('checkAccessibility should return true when accessibility permissions are granted', async () => {
  vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(true)
  const result = await MacOSPermissions.checkAccessibility()
  expect(result).toBe(true)
  expect(systemPreferences.isTrustedAccessibilityClient).toHaveBeenCalledWith(false)
})

test('checkAccessibility should return false when accessibility permissions are not granted', async () => {
  vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(false)
  const result = await MacOSPermissions.checkAccessibility()
  expect(result).toBe(false)
})

test('checkAccessibility should return false when check fails', async () => {
  const error = new Error('Permission check failed')
  vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockImplementation(() => {
    throw error
  })
  const result = await MacOSPermissions.checkAccessibility()
  expect(result).toBe(false)
})

test('checkAutomation should return true when automation permissions are granted', async () => {
  vi.mocked(execSync).mockReturnValue('true\n')
  const result = await MacOSPermissions.checkAutomation()
  expect(result).toBe(true)
  expect(execSync).toHaveBeenCalledWith(
    expect.stringContaining('osascript -e'),
    {
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }
  )
})

test('checkAutomation should return false when automation returns false', async () => {
  vi.mocked(execSync).mockReturnValue('false\n')
  const result = await MacOSPermissions.checkAutomation()
  expect(result).toBe(false)
})

test('checkAutomation should return false when automation check throws error', async () => {
  const error = new Error('Command failed')
  vi.mocked(execSync).mockImplementation(() => {
    throw error
  })
  const result = await MacOSPermissions.checkAutomation()
  expect(result).toBe(false)
})

test('checkAutomation should handle empty response from execSync', async () => {
  vi.mocked(execSync).mockReturnValue('')
  const result = await MacOSPermissions.checkAutomation()
  expect(result).toBe(false)
})

test('openAccessibilitySettings should open accessibility settings successfully', async () => {
  vi.mocked(shell.openExternal).mockResolvedValue(undefined)
  await MacOSPermissions.openAccessibilitySettings()
  expect(shell.openExternal).toHaveBeenCalledWith(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
  )
})

test('openAccessibilitySettings should fallback to privacy settings if accessibility fails', async () => {
  vi.mocked(shell.openExternal)
    .mockRejectedValueOnce(new Error('Failed to open accessibility'))
    .mockResolvedValueOnce(undefined)

    await MacOSPermissions.openAccessibilitySettings()

  expect(shell.openExternal).toHaveBeenCalledTimes(2)
  expect(shell.openExternal).toHaveBeenNthCalledWith(1,
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
  )
  expect(shell.openExternal).toHaveBeenNthCalledWith(2,
    'x-apple.systempreferences:com.apple.preference.security?Privacy'
  )
})

test('openAccessibilitySettings should fallback to system preferences if both accessibility and privacy fail', async () => {
  vi.mocked(shell.openExternal)
    .mockRejectedValueOnce(new Error('Failed to open accessibility'))
    .mockRejectedValueOnce(new Error('Failed to open privacy'))
    .mockResolvedValueOnce(undefined)

  await MacOSPermissions.openAccessibilitySettings()

  expect(shell.openExternal).toHaveBeenCalledTimes(3)
  expect(shell.openExternal).toHaveBeenNthCalledWith(3, 'x-apple.systempreferences:')
})

test('openAutomationSettings should open automation settings successfully', async () => {
  vi.mocked(shell.openExternal).mockResolvedValue(undefined)

  await MacOSPermissions.openAutomationSettings()

  expect(shell.openExternal).toHaveBeenCalledWith(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
  )
})

test('openAutomationSettings should fallback to privacy settings if automation fails', async () => {
  vi.mocked(shell.openExternal)
    .mockRejectedValueOnce(new Error('Failed to open automation'))
    .mockResolvedValueOnce(undefined)

  await MacOSPermissions.openAutomationSettings()

  expect(shell.openExternal).toHaveBeenCalledTimes(2)
  expect(shell.openExternal).toHaveBeenNthCalledWith(1,
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
  )
  expect(shell.openExternal).toHaveBeenNthCalledWith(2,
    'x-apple.systempreferences:com.apple.preference.security?Privacy'
  )
})

test('openAutomationSettings should fallback to system preferences if both automation and privacy fail', async () => {
  vi.mocked(shell.openExternal)
    .mockRejectedValueOnce(new Error('Failed to open automation'))
    .mockRejectedValueOnce(new Error('Failed to open privacy'))
    .mockResolvedValueOnce(undefined)

  await MacOSPermissions.openAutomationSettings()

  expect(shell.openExternal).toHaveBeenCalledTimes(3)
  expect(shell.openExternal).toHaveBeenNthCalledWith(3, 'x-apple.systempreferences:')
})
