
import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest'
import fs from 'fs'
import glob from 'glob'

// Mock fs and glob to redirect to test fixtures
vi.mock('fs')
vi.mock('glob')
vi.mock('../../tools/i18n_sort', () => ({
  sortLocales: vi.fn()
}))

// Mock multi-llm-ts to avoid real API calls and provide deterministic translations
vi.mock('multi-llm-ts', () => ({
  igniteEngine: vi.fn(() => ({
    buildModel: vi.fn(() => 'mocked-model'),
    complete: vi.fn(() => Promise.resolve({
      content: JSON.stringify([
        { "key": "changed_english", "translation": "Nouveau texte anglais" },
        { "key": "missing_key", "translation": "Cette clé existe en anglais mais pas en français" }
      ])
    }))
  })),
  Message: vi.fn((role, content) => ({ role, content }))
}))

const mockFs = vi.mocked(fs)
const mockGlob = vi.mocked(glob)
const mockFileSystem = new Map<string, string>()

async function setupMocks() {
  const realFs = await vi.importActual('fs') as typeof fs
  const realGlob = await vi.importActual('glob') as typeof glob

  // Create a stateful filesystem - track what gets written

  // Redirect filesystem calls to test fixtures
  mockFs.readdirSync.mockImplementation((dirPath: any) => {
    const pathStr = String(dirPath)
    if (pathStr.includes('locales')) {
      return realFs.readdirSync('tests/fixtures/i18n/locales') as any
    }
    return realFs.readdirSync(pathStr) as any
  })

  mockFs.readFileSync.mockImplementation((filePath: any, encoding?: any) => {
    
    const pathStr = String(filePath)

    // If we've written to this file this is wrong
    if (mockFileSystem.has(pathStr)) {
      throw new Error('No files should be read after being written')
    }
    
    // Otherwise redirect to test fixtures
    let redirectedPath = pathStr
    if (pathStr.includes('locales/')) {
      redirectedPath = pathStr.replace('locales/', 'tests/fixtures/i18n/locales/')
    } else if (pathStr.includes('tools/')) {
      redirectedPath = pathStr.replace('tools/', 'tests/fixtures/i18n/tools/')
    } else if (pathStr.includes('src/')) {
      redirectedPath = pathStr.replace('src/', 'tests/fixtures/i18n/src/')
    }
    return realFs.readFileSync(redirectedPath, encoding)
  })

  mockFs.existsSync.mockImplementation((filePath: any) => {
    const pathStr = String(filePath)
    
    // If we've written to this file this is wrong
    if (mockFileSystem.has(pathStr)) {
      throw new Error('No files should be read after being written')
    }
    
    // Otherwise check test fixtures
    let redirectedPath = pathStr
    if (pathStr.includes('locales/')) {
      redirectedPath = pathStr.replace('locales/', 'tests/fixtures/i18n/locales/')
    } else if (pathStr.includes('tools/')) {
      redirectedPath = pathStr.replace('tools/', 'tests/fixtures/i18n/tools/')
    } else if (pathStr.includes('src/')) {
      redirectedPath = pathStr.replace('src/', 'tests/fixtures/i18n/src/')
    }
    return realFs.existsSync(redirectedPath)
  })

  // Mock writeFileSync to update our stateful filesystem AND track final contents
  mockFs.writeFileSync.mockImplementation((filePath: any, content: any) => {
    mockFileSystem.set(filePath as string, content as string)
  })

  // @ts-expect-error mocking
  mockGlob.sync.mockImplementation((pattern: string) => {
    if (pattern.includes('src/')) {
      const redirectedPattern = pattern.replace('src/', 'tests/fixtures/i18n/src/')
      const files = realGlob.sync(redirectedPattern)
      return files.map(file => file.replace('tests/fixtures/i18n/', ''))
    }
    return []
  })

}

describe('i18n_check', () => {

  beforeAll(async () => {
    await setupMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFileSystem.clear()
  })

  test('should run i18n_check and validate final file contents', async () => {
    
    // Import and run i18n_check main function directly
    const { i18n_check } = await import('../../tools/i18n_check')
    await i18n_check(true)

    // Check that we have the expected files in our global record
    expect(mockFileSystem.has('locales/en.json')).toBe(true)
    expect(mockFileSystem.has('locales/fr.json')).toBe(true)
    expect(mockFileSystem.has('tools/en_snapshot.json')).toBe(true)

    // Parse the content since mockFileSystem stores strings
    const enContent = JSON.parse(mockFileSystem.get('locales/en.json') as string)
    const frContent = JSON.parse(mockFileSystem.get('locales/fr.json') as string)
    const snapshotContent = JSON.parse(mockFileSystem.get('tools/en_snapshot.json') as string)
    
    // Verify final EN file content (unused_key should be removed)
    expect(enContent).toEqual({
      "wrong_linked": "@:{'common.ok'}",
      "changed_english": "New English text",
      "missing_key": "This key exists in English but not in French",
      "normal_key": "This is a normal key",
      "common": {
        "ok": "OK"
      }
    })
    
    // Verify final FR file content - what SHOULD happen after all fixes
    expect(frContent).toEqual({
      // unused_key should be removed (not used in source code)
      "wrong_linked": "@:{'common.ok'}", // Should be fixed linked translation
      "changed_english": "Nouveau texte anglais", // Should be retranslated
      "normal_key": "Ceci est une clé normale", // Should be preserved
      "common": {
        "ok": "D'accord" // Should be preserved
      },
      "missing_key": "Cette clé existe en anglais mais pas en français" // Should be added since it's used in source
    })
    
    // Verify snapshot content (should contain final EN state after cleanup)
    expect(snapshotContent).toEqual({
      "wrong_linked": "@:{'common.ok'}",
      "changed_english": "New English text", 
      "missing_key": "This key exists in English but not in French",
      "normal_key": "This is a normal key",
      "common.ok": "OK"
    })

  })
})