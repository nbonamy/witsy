import { expect, test, describe, beforeEach, afterEach } from 'vitest'
import CliPlugin from '@/main/cli_plugin'
import fs from 'fs'
import os from 'os'
import path from 'path'

describe('CliPlugin', () => {

  let tempDir: string
  let plugin: CliPlugin

  beforeEach(() => {
    // Create temp directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-plugin-test-'))
    plugin = new CliPlugin({
      workDirPath: tempDir,
      workDirAccess: 'rw'
    })
  })

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  })

  describe('isEnabled', () => {
    test('returns true for rw access', () => {
      expect(plugin.isEnabled()).toBe(true)
    })

    test('returns true for ro access', () => {
      const roPlugin = new CliPlugin({ workDirPath: tempDir, workDirAccess: 'ro' })
      expect(roPlugin.isEnabled()).toBe(true)
    })

    test('returns false for none access', () => {
      const noPlugin = new CliPlugin({ workDirPath: tempDir, workDirAccess: 'none' })
      expect(noPlugin.isEnabled()).toBe(false)
    })

    test('returns false for empty path', () => {
      const noPathPlugin = new CliPlugin({ workDirPath: '', workDirAccess: 'rw' })
      expect(noPathPlugin.isEnabled()).toBe(false)
    })
  })

  describe('getName', () => {
    test('returns cli', () => {
      expect(plugin.getName()).toBe('cli')
    })
  })

  describe('getDescription', () => {
    test('includes read and write for rw access', () => {
      expect(plugin.getDescription()).toContain('read and write')
    })

    test('includes only read for ro access', () => {
      const roPlugin = new CliPlugin({ workDirPath: tempDir, workDirAccess: 'ro' })
      expect(roPlugin.getDescription()).toContain('read')
      expect(roPlugin.getDescription()).not.toContain('read and write')
    })
  })

  describe('getParameters', () => {
    test('includes write actions for rw access', () => {
      const params = plugin.getParameters()
      const actionParam = params.find(p => p.name === 'action')
      expect(actionParam?.enum).toContain('read_file')
      expect(actionParam?.enum).toContain('write_file')
      expect(actionParam?.enum).toContain('edit_file')
      expect(actionParam?.enum).toContain('create_directory')
      expect(actionParam?.enum).toContain('delete_file')
      expect(actionParam?.enum).toContain('move_file')
    })

    test('excludes write actions for ro access', () => {
      const roPlugin = new CliPlugin({ workDirPath: tempDir, workDirAccess: 'ro' })
      const params = roPlugin.getParameters()
      const actionParam = params.find(p => p.name === 'action')
      expect(actionParam?.enum).toContain('read_file')
      expect(actionParam?.enum).not.toContain('write_file')
      expect(actionParam?.enum).not.toContain('edit_file')
    })
  })

  describe('validatePath', () => {
    test('accepts absolute path within workDir', () => {
      const filePath = path.join(tempDir, 'test.txt')
      expect(plugin.validatePath(filePath)).toBe(filePath)
    })

    test('accepts relative path', () => {
      const result = plugin.validatePath('test.txt')
      expect(result).toBe(path.join(tempDir, 'test.txt'))
    })

    test('rejects path outside workDir', () => {
      expect(plugin.validatePath('/etc/passwd')).toBeNull()
    })

    test('rejects path traversal', () => {
      expect(plugin.validatePath('../../../etc/passwd')).toBeNull()
    })
  })

  describe('read_file', () => {
    test('reads full file', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'line1\nline2\nline3')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'read_file',
        path: 'test.txt'
      })

      expect(result.success).toBe(true)
      expect(result.content).toContain('line1')
      expect(result.content).toContain('line2')
      expect(result.content).toContain('line3')
      expect(result.totalLines).toBe(3)
      expect(result.linesRead).toBe(3)
      expect(result.lastModified).toBeDefined()
    })

    test('reads line range', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'line1\nline2\nline3\nline4\nline5')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'read_file',
        path: 'test.txt',
        start: 2,
        end: 4
      })

      expect(result.success).toBe(true)
      expect(result.content).toContain('line2')
      expect(result.content).toContain('line3')
      expect(result.content).toContain('line4')
      expect(result.content).not.toContain('line1')
      expect(result.content).not.toContain('line5')
      expect(result.linesRead).toBe(3)
      expect(result.totalLines).toBe(5)
    })

    test('returns error for missing file', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'read_file',
        path: 'notfound.txt'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    test('returns error for path outside workDir', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'read_file',
        path: '/etc/passwd'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    test('formats output with line numbers', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'hello\nworld')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'read_file',
        path: 'test.txt'
      })

      expect(result.success).toBe(true)
      expect(result.content).toMatch(/^\s+1→hello/)
      expect(result.content).toMatch(/\s+2→world/)
    })
  })

  describe('write_file', () => {
    test('writes new file', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'write_file',
        path: 'new.txt',
        content: 'hello world'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tempDir, 'new.txt'))).toBe(true)
      expect(fs.readFileSync(path.join(tempDir, 'new.txt'), 'utf-8')).toBe('hello world')
    })

    test('overwrites existing file', async () => {
      const filePath = path.join(tempDir, 'existing.txt')
      fs.writeFileSync(filePath, 'old content')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'write_file',
        path: 'existing.txt',
        content: 'new content'
      })

      expect(result.success).toBe(true)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content')
    })

    test('validates lastModified', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'content')
      const stats = fs.statSync(filePath)

      // Modify file
      fs.writeFileSync(filePath, 'modified')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'write_file',
        path: 'test.txt',
        content: 'new content',
        lastModified: stats.mtimeMs
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('modified')
    })

    test('fails with ro access', async () => {
      const roPlugin = new CliPlugin({ workDirPath: tempDir, workDirAccess: 'ro' })

      const result = await roPlugin.execute({ model: 'test' }, {
        action: 'write_file',
        path: 'test.txt',
        content: 'content'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Write access not granted')
    })
  })

  describe('list_files', () => {
    test('lists files and directories with separator', async () => {
      // Create test structure
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content')
      fs.writeFileSync(path.join(tempDir, 'file2.json'), 'content')
      fs.mkdirSync(path.join(tempDir, 'subdir'))

      const result = await plugin.execute({ model: 'test' }, {
        action: 'list_files',
        path: '.'
      })

      expect(result.success).toBe(true)
      expect(result.fileCount).toBe(3)
      // Directories should have trailing separator
      expect(result.content).toContain('subdir' + path.sep)
      // Files should not
      expect(result.content).toContain('file1.txt')
      expect(result.content).toContain('file2.json')
    })

    test('shows only first 3 items with summary', async () => {
      // Create 5 files
      for (let i = 1; i <= 5; i++) {
        fs.writeFileSync(path.join(tempDir, `file${i}.txt`), 'content')
      }

      const result = await plugin.execute({ model: 'test' }, {
        action: 'list_files',
        path: '.'
      })

      expect(result.success).toBe(true)
      expect(result.fileCount).toBe(5)
      // Should show first 3 items
      expect(result.content).toContain('file1.txt')
      expect(result.content).toContain('file2.txt')
      expect(result.content).toContain('file3.txt')
      // Should NOT show items 4 and 5
      expect(result.content).not.toContain('file4.txt')
      expect(result.content).not.toContain('file5.txt')
      // Should have summary line
      expect(result.content).toContain('... +2 more items')
    })

    test('shows all items when 3 or fewer', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content')
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'content')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'list_files',
        path: '.'
      })

      expect(result.success).toBe(true)
      expect(result.fileCount).toBe(2)
      expect(result.content).toContain('file1.txt')
      expect(result.content).toContain('file2.txt')
      // Should NOT have summary line
      expect(result.content).not.toContain('more items')
    })

    test('sorts directories first', async () => {
      fs.writeFileSync(path.join(tempDir, 'aaa.txt'), 'content')
      fs.mkdirSync(path.join(tempDir, 'zzz'))

      const result = await plugin.execute({ model: 'test' }, {
        action: 'list_files',
        path: '.'
      })

      expect(result.success).toBe(true)
      const lines = result.content?.split('\n') || []
      // Directory should come first despite alphabetical order
      expect(lines[0]).toContain('zzz' + path.sep)
      expect(lines[1]).toContain('aaa.txt')
    })

    test('fails on non-directory', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'content')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'list_files',
        path: 'test.txt'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not a directory')
    })
  })

  describe('write_file', () => {
    test('creates new file', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'write_file',
        path: 'new.txt',
        content: 'hello'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tempDir, 'new.txt'))).toBe(true)
    })

    test('creates parent directories when creating new file', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'write_file',
        path: 'subdir/nested/file.txt',
        content: 'content'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tempDir, 'subdir/nested/file.txt'))).toBe(true)
    })

    test('overwrites existing file', async () => {
      const filePath = path.join(tempDir, 'existing.txt')
      fs.writeFileSync(filePath, 'old content')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'write_file',
        path: 'existing.txt',
        content: 'new content'
      })

      expect(result.success).toBe(true)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content')
    })
  })

  describe('create_directory', () => {
    test('creates directory', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'create_directory',
        path: 'newdir'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tempDir, 'newdir'))).toBe(true)
      expect(fs.statSync(path.join(tempDir, 'newdir')).isDirectory()).toBe(true)
    })

    test('creates nested directories', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'create_directory',
        path: 'a/b/c'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tempDir, 'a/b/c'))).toBe(true)
    })

    test('fails if directory exists', async () => {
      fs.mkdirSync(path.join(tempDir, 'existing'))

      const result = await plugin.execute({ model: 'test' }, {
        action: 'create_directory',
        path: 'existing'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })
  })

  describe('edit_file', () => {
    test('replaces line range', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'line1\nline2\nline3\nline4\nline5')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'edit_file',
        path: 'test.txt',
        start: 2,
        end: 4,
        content: 'new2\nnew3'
      })

      expect(result.success).toBe(true)
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toBe('line1\nnew2\nnew3\nline5')
    })

    test('deletes lines with empty content', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'line1\nline2\nline3')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'edit_file',
        path: 'test.txt',
        start: 2,
        end: 2,
        content: ''
      })

      expect(result.success).toBe(true)
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toBe('line1\nline3')
    })

    test('validates lastModified', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'line1\nline2')
      const stats = fs.statSync(filePath)

      // Modify file
      fs.writeFileSync(filePath, 'modified')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'edit_file',
        path: 'test.txt',
        start: 1,
        end: 1,
        content: 'new',
        lastModified: stats.mtimeMs
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('modified')
    })
  })

  describe('delete_file', () => {
    test('deletes file', async () => {
      const filePath = path.join(tempDir, 'test.txt')
      fs.writeFileSync(filePath, 'content')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'delete_file',
        path: 'test.txt'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(filePath)).toBe(false)
    })

    test('deletes directory', async () => {
      const dirPath = path.join(tempDir, 'subdir')
      fs.mkdirSync(dirPath)
      fs.writeFileSync(path.join(dirPath, 'file.txt'), 'content')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'delete_file',
        path: 'subdir'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(dirPath)).toBe(false)
    })

    test('fails for missing file', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'delete_file',
        path: 'notfound.txt'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('move_file', () => {
    test('moves file', async () => {
      const srcPath = path.join(tempDir, 'src.txt')
      fs.writeFileSync(srcPath, 'content')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'move_file',
        path: 'src.txt',
        newPath: 'dst.txt'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(srcPath)).toBe(false)
      expect(fs.existsSync(path.join(tempDir, 'dst.txt'))).toBe(true)
      expect(fs.readFileSync(path.join(tempDir, 'dst.txt'), 'utf-8')).toBe('content')
    })

    test('creates parent directories for destination', async () => {
      const srcPath = path.join(tempDir, 'src.txt')
      fs.writeFileSync(srcPath, 'content')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'move_file',
        path: 'src.txt',
        newPath: 'subdir/dst.txt'
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tempDir, 'subdir/dst.txt'))).toBe(true)
    })

    test('fails if destination exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'src.txt'), 'content')
      fs.writeFileSync(path.join(tempDir, 'dst.txt'), 'existing')

      const result = await plugin.execute({ model: 'test' }, {
        action: 'move_file',
        path: 'src.txt',
        newPath: 'dst.txt'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })

    test('fails if source not found', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'move_file',
        path: 'notfound.txt',
        newPath: 'dst.txt'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('run_command', () => {
    test('executes simple command', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'echo hello'
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('hello')
      expect(result.exitCode).toBe(0)
    })

    test('returns stderr on command error', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'ls /nonexistent_path_12345'
      })

      expect(result.success).toBe(false)
      expect(result.exitCode).not.toBe(0)
    })

    test('blocks rm command', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'rm test.txt'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('blocked')
    })

    test('blocks mv command', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'mv a.txt b.txt'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('blocked')
    })

    test('allows command chaining with &&', async () => {
      // COMMENTED OUT: Command chaining is now allowed
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'echo a && echo b'
      })

      expect(result.success).toBe(true)
    })

    test('allows command chaining with ||', async () => {
      // COMMENTED OUT: Command chaining is now allowed
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'echo a || echo b'
      })

      expect(result.success).toBe(true)
    })

    test('allows command chaining with ;', async () => {
      // COMMENTED OUT: Command chaining is now allowed
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'echo a; echo b'
      })

      expect(result.success).toBe(true)
    })

    test('allows pipes', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'echo hello | cat'
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('hello')
    })

    test('validates cwd within workDir', async () => {
      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'pwd',
        cwd: '/etc'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid working directory')
    })

    test('uses custom cwd within workDir', async () => {
      const subdir = path.join(tempDir, 'subdir')
      fs.mkdirSync(subdir)

      const result = await plugin.execute({ model: 'test' }, {
        action: 'run_command',
        command: 'pwd',
        cwd: 'subdir'
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('subdir')
    })
  })

  describe('description methods', () => {
    test('getRunningDescription returns appropriate messages', () => {
      expect(plugin.getRunningDescription('', { action: 'read_file', path: 'test.txt' })).toBe('Read(test.txt)')
      expect(plugin.getRunningDescription('', { action: 'write_file', path: 'test.txt' })).toBe('Write(test.txt)')
      expect(plugin.getRunningDescription('', { action: 'delete_file', path: 'test.txt' })).toBe('Delete(test.txt)')
      expect(plugin.getRunningDescription('', { action: 'run_command', command: 'echo hi' })).toBe('Bash(echo hi)')
    })

    test('getCompletedDescription returns success messages', () => {
      const successResult = { success: true, linesRead: 10, totalLines: 10 }
      expect(plugin.getCompletedDescription('', { action: 'read_file', path: 'test.txt' }, successResult)).toContain('Read')
    })

    test('getCompletedDescription returns failure messages', () => {
      const errorResult = { success: false, error: 'File not found' }
      expect(plugin.getCompletedDescription('', { action: 'read_file', path: 'test.txt' }, errorResult)).toContain('Failed')
    })
  })
})
