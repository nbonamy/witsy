import { describe, expect, test, vi, beforeEach } from 'vitest'
import { handleCommand, COMMANDS } from '../../../src/cli/commands'
import { state } from '../../../src/cli/state'

// Mock dependencies
vi.mock('../../../src/cli/api')
vi.mock('../../../src/cli/display', () => ({
  displayFooter: vi.fn(),
  clearFooter: vi.fn(),
  displayHeader: vi.fn(),
  displayConversation: vi.fn(),
}))
vi.mock('../../../src/cli/input', () => ({
  promptInput: vi.fn(),
}))
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}))
vi.mock('chalk', () => ({
  default: {
    yellow: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,
    rgb: () => (s: string) => s,
  },
}))

describe('CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.port = 4321
    state.engine = 'openai'
    state.model = 'gpt-4'
  })

  test('COMMANDS constant has expected structure', () => {
    expect(COMMANDS).toBeDefined()
    expect(Array.isArray(COMMANDS)).toBe(true)
    expect(COMMANDS.length).toBeGreaterThan(0)

    COMMANDS.forEach(cmd => {
      expect(cmd).toHaveProperty('name')
      expect(cmd).toHaveProperty('value')
      expect(cmd).toHaveProperty('description')
      expect(cmd.name).toMatch(/^\//)
    })
  })

  test('COMMANDS includes essential commands', () => {
    const commandNames = COMMANDS.map(cmd => cmd.name)
    expect(commandNames).toContain('/help')
    expect(commandNames).toContain('/exit')
    expect(commandNames).toContain('/clear')
  })

  test('handleCommand is a function', () => {
    expect(typeof handleCommand).toBe('function')
  })
})
