import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { executeCommand, analyzeCommand, validateWorkingDirectory } from '../../../src/main/shell'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Shell Executor', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'shell-test-'))
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Command Analysis', () => {
    it('should detect dangerous rm -rf commands', () => {
      const result = analyzeCommand('rm -rf /')
      expect(result.isDangerous).toBe(true)
      expect(result.dangersDetected).toContain('recursive file deletion (rm -rf)')
    })

    it('should detect fork bombs', () => {
      const result = analyzeCommand(':(){ :|:& };:')
      expect(result.isDangerous).toBe(true)
      expect(result.dangersDetected).toContain('fork bomb')
    })

    it('should detect sudo commands', () => {
      const result = analyzeCommand('sudo rm -rf /')
      expect(result.isDangerous).toBe(true)
      expect(result.dangersDetected).toContain('privilege escalation (sudo)')
    })

    it('should detect command chaining operators', () => {
      const result = analyzeCommand('ls && rm file')
      expect(result.hasForbiddenOperators).toBe(true)
      expect(result.dangersDetected).toContain('command chaining operators (&&, ||, ;)')
    })

    it('should allow safe commands', () => {
      const result = analyzeCommand('ls -la')
      expect(result.isDangerous).toBe(false)
      expect(result.hasForbiddenOperators).toBe(false)
    })

    it('should allow pipes and redirects', () => {
      const result = analyzeCommand('cat file.txt | grep pattern > output.txt')
      expect(result.hasForbiddenOperators).toBe(false)
    })

    describe('Project Context Blocking', () => {
      // Unix commands
      it('should block rm in project context', () => {
        const result = analyzeCommand('rm file.txt', '/project')
        expect(result.blockedCommand).toBe('rm')
      })

      it('should block rmdir in project context', () => {
        const result = analyzeCommand('rmdir folder', '/project')
        expect(result.blockedCommand).toBe('rm')
      })

      it('should block mv in project context', () => {
        const result = analyzeCommand('mv a.txt b.txt', '/project')
        expect(result.blockedCommand).toBe('mv')
      })

      // PowerShell commands
      it('should block Remove-Item in project context', () => {
        const result = analyzeCommand('Remove-Item file.txt', '/project')
        expect(result.blockedCommand).toBe('Remove-Item')
      })

      it('should block del in project context', () => {
        const result = analyzeCommand('del file.txt', '/project')
        expect(result.blockedCommand).toBe('Remove-Item')
      })

      it('should block Move-Item in project context', () => {
        const result = analyzeCommand('Move-Item a.txt b.txt', '/project')
        expect(result.blockedCommand).toBe('Move-Item')
      })

      // Edge cases with embedded commands
      it('should block rm in find -exec', () => {
        const result = analyzeCommand('find . -exec rm {} \\;', '/project')
        expect(result.blockedCommand).toBe('rm')
      })

      it('should block rm after xargs', () => {
        const result = analyzeCommand('ls | xargs rm', '/project')
        expect(result.blockedCommand).toBe('rm')
      })

      // Without project context - should allow
      it('should allow rm without project context', () => {
        const result = analyzeCommand('rm file.txt')
        expect(result.blockedCommand).toBeUndefined()
      })

      it('should allow mv without project context', () => {
        const result = analyzeCommand('mv a.txt b.txt')
        expect(result.blockedCommand).toBeUndefined()
      })

      // Safe commands still work in project context
      it('should allow ls in project context', () => {
        const result = analyzeCommand('ls -la', '/project')
        expect(result.blockedCommand).toBeUndefined()
        expect(result.isDangerous).toBe(false)
      })

      it('should allow grep in project context', () => {
        const result = analyzeCommand('grep pattern file.txt', '/project')
        expect(result.blockedCommand).toBeUndefined()
        expect(result.isDangerous).toBe(false)
      })

      it('should allow cat in project context', () => {
        const result = analyzeCommand('cat file.txt', '/project')
        expect(result.blockedCommand).toBeUndefined()
        expect(result.isDangerous).toBe(false)
      })
    })
  })

  describe('Path Validation', () => {
    it('should validate working directory within project', () => {
      const result = validateWorkingDirectory(tempDir, tempDir)
      expect(result.valid).toBe(true)
    })

    it('should reject working directory outside project', () => {
      const result = validateWorkingDirectory('/tmp', tempDir)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('outside project directory')
    })

    it('should reject invalid paths', () => {
      const result = validateWorkingDirectory('/nonexistent/path', tempDir)
      expect(result.valid).toBe(false)
    })
  })

  describe('Command Execution', () => {
    it('should execute simple commands', async () => {
      const result = await executeCommand({
        command: 'echo "hello"',
        cwd: tempDir,
      })
      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('hello')
      expect(result.exitCode).toBe(0)
    })

    it('should respect custom timeout', async () => {
      const result = await executeCommand({
        command: 'sleep 5',
        cwd: tempDir,
        timeoutMs: 1000, // 1 second timeout
      })
      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(124) // Standard timeout exit code
      expect(result.error).toContain('timed out')
    }, 10000)

    it('should use default timeout of 15s when not specified', async () => {
      const result = await executeCommand({
        command: 'echo "test"',
        cwd: tempDir,
        // No timeoutMs specified, should use default 15000ms
      })
      expect(result.success).toBe(true)
    })

    it('should allow custom timeouts up to 60s', async () => {
      const result = await executeCommand({
        command: 'echo "test"',
        cwd: tempDir,
        timeoutMs: 60000, // Max allowed
      })
      expect(result.success).toBe(true)
    })

    it('should handle command errors', async () => {
      const result = await executeCommand({
        command: 'nonexistentcommand',
        cwd: tempDir,
      })
      expect(result.success).toBe(false)
      expect(result.exitCode).not.toBe(0)
    })

    it('should restrict commands to project path', async () => {
      const result = await executeCommand({
        command: 'ls',
        cwd: '/tmp',
        restrictToPath: tempDir,
      })
      expect(result.success).toBe(false)
      expect(result.stderr).toContain('outside project directory')
    })

    it('should handle stderr output', async () => {
      const result = await executeCommand({
        command: 'ls /nonexistent 2>&1',
        cwd: tempDir,
      })
      expect(result.success).toBe(false)
      expect(result.stderr || result.stdout).toContain('No such file or directory')
    })
  })
})
