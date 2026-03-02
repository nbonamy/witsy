/**
 * Path utilities for cross-platform path handling.
 *
 * IMPORTANT: This module is electron-agnostic and can be used in both
 * main and renderer processes. Do not add any electron-specific imports.
 */

/**
 * Path separator for the current platform.
 * '\\' on Windows, '/' elsewhere.
 */
export const pathSeparator = (window?.api?.platform) === 'win32' ? '\\' : '/'

/**
 * Get the basename (last segment) of a path, handling both forward and back slashes.
 * Works on both Unix and Windows paths.
 *
 * @example
 * pathBasename('/users/foo/project') // 'project'
 * pathBasename('C:\\Users\\foo\\project') // 'project'
 * pathBasename('file.txt') // 'file.txt'
 */
export const pathBasename = (path: string): string => {
  return path.split(/[/\\]/).pop() || path
}

/**
 * Strip leading path separator (either / or \) from a path.
 *
 * @example
 * stripLeadingSeparator('/foo/bar') // 'foo/bar'
 * stripLeadingSeparator('\\foo\\bar') // 'foo\\bar'
 * stripLeadingSeparator('foo/bar') // 'foo/bar'
 */
export const stripLeadingSeparator = (path: string): string => {
  return path.replace(/^[/\\]/, '')
}

/**
 * Get the parent directory path, handling both forward and back slashes.
 * Works on both Unix and Windows paths.
 *
 * @example
 * pathDirname('/users/foo/project') // '/users/foo'
 * pathDirname('C:\\Users\\foo\\project') // 'C:\\Users\\foo'
 * pathDirname('/users/foo/file.txt') // '/users/foo'
 * pathDirname('file.txt') // ''
 */
export const pathDirname = (path: string): string => {
  const lastSepIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (lastSepIndex === -1) return ''
  return path.substring(0, lastSepIndex)
}

/**
 * Extract filename without extension from a file path.
 * Used for generating export filenames.
 *
 * @example
 * getExportFilename('/project/doc.md', 'default') // 'doc'
 * getExportFilename(undefined, 'default') // 'default'
 */
export const getExportFilename = (filePath: string | undefined, defaultName: string): string => {
  if (!filePath) return defaultName
  const parts = filePath.split(/[/\\]/)
  const filename = parts[parts.length - 1]
  return filename.replace(/\.[^/.]+$/, '')
}
