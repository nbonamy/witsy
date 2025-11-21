import { describe, expect, test, beforeEach, afterEach } from 'vitest'
import { state } from '@/cli/state'
import { saveCliConfig, loadCliConfig } from '@/cli/config'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('CLI History Tracking', () => {
  let tempDir: string

  beforeEach(() => {
    // Create temp directory for test config
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-cli-history-test-'))

    // Setup state
    state.userDataPath = tempDir
    state.cliConfig = {
      historySize: 50,
      history: []
    }
  })

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('adds command to history', () => {
    // Simulate adding a command
    const command = 'tell me a joke'
    state.cliConfig!.history.push(command)
    saveCliConfig(state.userDataPath, state.cliConfig!)

    // Reload and verify
    const loaded = loadCliConfig(state.userDataPath)
    expect(loaded.history).toContain(command)
  })

  test('does not add consecutive duplicates', () => {
    const command = 'tell me a joke'

    // Add first command
    state.cliConfig!.history.push(command)

    // Simulate checking for duplicate (as done in cli.ts)
    const lastCommand = state.cliConfig!.history[state.cliConfig!.history.length - 1]
    if (command !== lastCommand) {
      state.cliConfig!.history.push(command)
    }

    expect(state.cliConfig!.history.length).toBe(1)
    expect(state.cliConfig!.history).toEqual([command])
  })

  test('allows non-consecutive duplicates', () => {
    const commands = ['tell me a joke', 'what is 2+2', 'tell me a joke']

    // Add commands
    for (const cmd of commands) {
      const lastCommand = state.cliConfig!.history[state.cliConfig!.history.length - 1]
      if (cmd !== lastCommand) {
        state.cliConfig!.history.push(cmd)
      }
    }

    expect(state.cliConfig!.history).toEqual(commands)
  })

  test('truncates history to historySize when saving', () => {
    // Set small history size
    state.cliConfig!.historySize = 3

    // Add more commands than historySize
    const commands = ['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5']
    state.cliConfig!.history = commands

    saveCliConfig(state.userDataPath, state.cliConfig!)

    // Reload and verify truncation
    const loaded = loadCliConfig(state.userDataPath)
    expect(loaded.history.length).toBe(3)
    expect(loaded.history).toEqual(['cmd3', 'cmd4', 'cmd5']) // Last 3 items
  })

  test('preserves history across sessions', () => {
    const commands = ['cmd1', 'cmd2', 'cmd3']

    // Add commands and save
    state.cliConfig!.history = commands
    saveCliConfig(state.userDataPath, state.cliConfig!)

    // Simulate new session: reload config
    const loaded = loadCliConfig(state.userDataPath)
    expect(loaded.history).toEqual(commands)

    // Add more commands
    loaded.history.push('cmd4')
    saveCliConfig(state.userDataPath, loaded)

    // Reload again
    const reloaded = loadCliConfig(state.userDataPath)
    expect(reloaded.history).toEqual(['cmd1', 'cmd2', 'cmd3', 'cmd4'])
  })

  test('handles empty history gracefully', () => {
    saveCliConfig(state.userDataPath, state.cliConfig!)

    const loaded = loadCliConfig(state.userDataPath)
    expect(loaded.history).toEqual([])
  })

  test('respects custom historySize', () => {
    state.cliConfig!.historySize = 10

    // Add 15 commands
    for (let i = 1; i <= 15; i++) {
      state.cliConfig!.history.push(`command${i}`)
    }

    saveCliConfig(state.userDataPath, state.cliConfig!)

    // Reload and verify only last 10 are kept
    const loaded = loadCliConfig(state.userDataPath)
    expect(loaded.history.length).toBe(10)
    expect(loaded.history[0]).toBe('command6')
    expect(loaded.history[9]).toBe('command15')
  })
})
