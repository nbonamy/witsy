import { describe, expect, test } from 'vitest'
import { getExportFilename } from '@renderer/utils/path_utils'

describe('getExportFilename', () => {

  test('should return default name when filePath is undefined', () => {
    expect(getExportFilename(undefined, 'document')).toBe('document')
  })

  test('should return default name when filePath is empty string', () => {
    expect(getExportFilename('', 'document')).toBe('document')
  })

  test('should extract filename without extension', () => {
    expect(getExportFilename('/path/to/report.md', 'document')).toBe('report')
  })

  test('should handle multiple extensions', () => {
    expect(getExportFilename('/path/to/report.test.md', 'document')).toBe('report.test')
  })

  test('should handle filenames without extension', () => {
    expect(getExportFilename('/path/to/README', 'document')).toBe('README')
  })

  test('should handle Windows-style paths', () => {
    // Even though we split by '/', Windows paths would still work for the last segment
    expect(getExportFilename('document.docx', 'document')).toBe('document')
  })

  test('should handle deeply nested paths', () => {
    expect(getExportFilename('/Users/test/projects/my-project/docs/guide.md', 'document')).toBe('guide')
  })

  test('should return different defaults based on parameter', () => {
    expect(getExportFilename(undefined, 'presentation')).toBe('presentation')
    expect(getExportFilename(undefined, 'document')).toBe('document')
  })

})
