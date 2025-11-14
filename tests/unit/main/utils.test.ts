import { test, expect, vi, beforeEach } from 'vitest'
import { getCachedText, putCachedText, fixPath, wait } from '../../src/main/utils'

// Mock node:child_process
vi.mock('node:child_process')

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn()
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  
  // Reset process.env for each test
  delete process.env.PATH
  delete process.env.SHELL
  delete process.env.HOME
  
  // Reset platform to a default
  Object.defineProperty(process, 'platform', {
    value: 'darwin',
    writable: true
  })
})

test('putCachedText and getCachedText should work together', () => {
  const text = 'Hello, World!'
  const id = putCachedText(text)
  
  expect(id).toBeDefined()
  expect(typeof id).toBe('string')
  
  const retrievedText = getCachedText(id)
  expect(retrievedText).toBe(text)
})

test('getCachedText should return undefined for non-existent id and clean up', () => {
  const nonExistentId = 'non-existent-id'
  const result = getCachedText(nonExistentId)
  
  expect(result).toBeUndefined()
  
  // Second call should also return undefined (cache cleaned up)
  const secondResult = getCachedText(nonExistentId)
  expect(secondResult).toBeUndefined()
})

test('getCachedText should delete cache entry after retrieval', () => {
  const text = 'Test text'
  const id = putCachedText(text)
  
  // First retrieval should work
  const firstResult = getCachedText(id)
  expect(firstResult).toBe(text)
  
  // Second retrieval should return undefined (cache cleared)
  const secondResult = getCachedText(id)
  expect(secondResult).toBeUndefined()
})

// Tests for fixPath function
test('fixPath should return early on Windows', async () => {
  const { execSync } = await import('node:child_process')
  
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    writable: true
  })
  
  process.env.PATH = 'C:\\Windows\\System32'
  const originalPath = process.env.PATH
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  
  await fixPath()
  
  expect(execSync).not.toHaveBeenCalled()
  expect(process.env.PATH).toBe(originalPath)
  expect(consoleSpy).toHaveBeenCalledWith('PATH', originalPath)
  
  consoleSpy.mockRestore()
})

test('fixPath should handle basic shell PATH on macOS', async () => {
  const { execSync } = await import('node:child_process')
  const fs = await import('fs')
  
  vi.mocked(execSync).mockReturnValue(Buffer.from('_SHELL_ENV_DELIMITER_/usr/bin:/bin_SHELL_ENV_DELIMITER_'))
  vi.mocked(fs.default.existsSync).mockReturnValue(false)
  
  process.env.SHELL = '/bin/bash'
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  
  await fixPath()
  
  expect(execSync).toHaveBeenCalledWith(
    '/bin/bash -l -c \'echo -n "_SHELL_ENV_DELIMITER_"; printenv PATH; echo -n "_SHELL_ENV_DELIMITER_";\''
  )
  expect(process.env.PATH).toBe('/usr/bin:/bin')
  
  consoleSpy.mockRestore()
})

test('fixPath should add homebrew paths on macOS when they exist', async () => {
  const { execSync } = await import('node:child_process')
  const fs = await import('fs')
  
  vi.mocked(execSync).mockReturnValue(Buffer.from('_SHELL_ENV_DELIMITER_/usr/bin:/bin_SHELL_ENV_DELIMITER_'))
  vi.mocked(fs.default.existsSync)
    .mockImplementation((path) => {
      const pathStr = path.toString()
      return pathStr === '/opt/homebrew/bin' || pathStr === '/usr/local/bin'
    })
  
  process.env.SHELL = '/bin/bash'
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  
  await fixPath()
  
  expect(process.env.PATH).toBe('/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin')
  
  consoleSpy.mockRestore()
})

test('fixPath should handle nu shell', async () => {
  const { execSync } = await import('node:child_process')
  const fs = await import('fs')
  
  vi.mocked(execSync).mockReturnValue(Buffer.from('_SHELL_ENV_DELIMITER_/usr/bin:/bin_SHELL_ENV_DELIMITER_'))
  vi.mocked(fs.default.existsSync).mockReturnValue(false)
  
  process.env.SHELL = '/usr/bin/nu'
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  
  await fixPath()
  
  expect(execSync).toHaveBeenCalledWith(
    '/usr/bin/nu -l -c \'print "_SHELL_ENV_DELIMITER_"; printenv PATH; print "_SHELL_ENV_DELIMITER_";\''
  )
  
  consoleSpy.mockRestore()
})

test('fixPath should handle nvm using nvm command', async () => {
  const { execSync } = await import('node:child_process')
  const fs = await import('fs')
  
  vi.mocked(execSync)
    .mockReturnValueOnce(Buffer.from('_SHELL_ENV_DELIMITER_/usr/bin:/bin_SHELL_ENV_DELIMITER_'))
    .mockReturnValueOnce(Buffer.from('_SHELL_NVM_DELIMITER_/home/user/.nvm/versions/node/v18.17.0/bin/node_SHELL_NVM_DELIMITER_'))
  
  vi.mocked(fs.default.existsSync)
    .mockImplementation((path) => {
      const pathStr = path.toString()
      return pathStr === '/home/user/.nvm/versions/node/v18.17.0/bin/node'
    })
  
  process.env.SHELL = '/bin/bash'
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  
  await fixPath()
  
  expect(process.env.PATH).toBe('/usr/bin:/bin:/home/user/.nvm/versions/node/v18.17.0/bin')
  
  consoleSpy.mockRestore()
})

test('fixPath should handle nvm using files when nvm command fails', async () => {
  const { execSync } = await import('node:child_process')
  const fs = await import('fs')
  
  vi.mocked(execSync)
    .mockReturnValueOnce(Buffer.from('_SHELL_ENV_DELIMITER_/usr/bin:/bin_SHELL_ENV_DELIMITER_'))
    .mockImplementationOnce(() => { throw new Error('nvm command failed') })
  
  process.env.HOME = '/home/user'
  
  vi.mocked(fs.default.existsSync)
    .mockImplementation((path) => {
      const pathStr = path.toString()
      return pathStr === '/home/user/.nvm/alias/default' || pathStr === '/home/user/.nvm/versions/node'
    })
  
  vi.mocked(fs.default.readFileSync).mockReturnValue('18')
  vi.mocked(fs.default.readdirSync).mockReturnValue(['v16.20.0', 'v18.17.0', 'v20.5.0'] as any)
  
  process.env.SHELL = '/bin/bash'
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  
  await fixPath()
  
  expect(process.env.PATH).toBe('/usr/bin:/bin:/home/user/.nvm/versions/node/v18.17.0/bin')
  
  consoleSpy.mockRestore()
})

test('fixPath should handle errors gracefully', async () => {
  const { execSync } = await import('node:child_process')
  
  vi.mocked(execSync).mockImplementation(() => { throw new Error('Command failed') })
  
  process.env.SHELL = '/bin/bash'
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  
  await fixPath()
  
  expect(consoleSpy).toHaveBeenCalledWith('Failed to fix PATH:', expect.any(Error))
  
  consoleSpy.mockRestore()
})

test('fixPath should handle missing shell env delimiter', async () => {
  const { execSync } = await import('node:child_process')
  
  vi.mocked(execSync).mockReturnValue(Buffer.from('no delimiter here'))
  
  process.env.SHELL = '/bin/bash'
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  
  await fixPath()
  
  expect(consoleSpy).toHaveBeenCalledWith('Failed to fix PATH:', expect.any(Error))
  
  consoleSpy.mockRestore()
})

// Tests for wait function
test('wait should use Promise timeout on macOS', async () => {
  Object.defineProperty(process, 'platform', {
    value: 'darwin',
    writable: true
  })
  
  const start = Date.now()
  await wait(100)
  const elapsed = Date.now() - start
  
  expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some tolerance
  expect(elapsed).toBeLessThan(150)
})

test('wait should use busy wait when DEBUG is set on non-macOS', async () => {
  Object.defineProperty(process, 'platform', {
    value: 'linux',
    writable: true
  })
  
  const originalDebug = process.env.DEBUG
  process.env.DEBUG = 'true'
  
  const start = Date.now()
  await wait(50)
  const elapsed = Date.now() - start
  
  expect(elapsed).toBeGreaterThanOrEqual(40) // Allow some tolerance
  expect(elapsed).toBeLessThan(100)
  
  // Restore original DEBUG
  if (originalDebug !== undefined) {
    process.env.DEBUG = originalDebug
  } else {
    delete process.env.DEBUG
  }
})
