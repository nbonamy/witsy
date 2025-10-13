
export type CommandCategory =
  | 'file'
  | 'edit'
  | 'view'
  | 'window'
  | 'help'
  | 'navigation'

export type CommandPaletteItem = {
  id: string
  label: string
  category: CommandCategory
  shortcut?: string
  icon?: string
  enabled: boolean
  callback: () => void | Promise<void>
  keywords?: string[]
}

const RECENT_COMMANDS_KEY = 'commandPalette.recent'
const MAX_RECENT_COMMANDS = 10

export class CommandRegistry {
  private commands: Map<string, CommandPaletteItem>
  private recentCommandIds: string[]

  constructor() {
    this.commands = new Map()
    this.recentCommandIds = this.loadRecentCommands()
  }

  register(command: CommandPaletteItem): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command with id "${command.id}" is already registered`)
    }
    this.commands.set(command.id, command)
  }

  unregister(id: string): void {
    this.commands.delete(id)
  }

  clear(): void {
    this.commands.clear()
  }

  getAll(): CommandPaletteItem[] {
    return Array.from(this.commands.values())
  }

  getByCategory(category: CommandCategory): CommandPaletteItem[] {
    return this.getAll().filter(cmd => cmd.category === category)
  }

  getRecent(): CommandPaletteItem[] {
    // Filter to only existing commands and maintain order
    return this.recentCommandIds
      .map(id => this.commands.get(id))
      .filter(cmd => cmd !== undefined) as CommandPaletteItem[]
  }

  search(query: string): CommandPaletteItem[] {
    if (!query.trim()) {
      return []
    }

    const results = this.getAll()
      .map(command => ({
        command,
        score: this.fuzzyMatch(query, command)
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => {
        // Sort by score descending, then alphabetically by label
        if (b.score !== a.score) {
          return b.score - a.score
        }
        return a.command.label.localeCompare(b.command.label)
      })
      .map(result => result.command)

    return results
  }

  markAsExecuted(id: string): void {
    // Remove if exists
    this.recentCommandIds = this.recentCommandIds.filter(cmdId => cmdId !== id)

    // Add to front
    this.recentCommandIds.unshift(id)

    // Limit to max
    if (this.recentCommandIds.length > MAX_RECENT_COMMANDS) {
      this.recentCommandIds = this.recentCommandIds.slice(0, MAX_RECENT_COMMANDS)
    }

    // Persist
    this.saveRecentCommands()
  }

  private fuzzyMatch(query: string, command: CommandPaletteItem): number {
    const lowerQuery = query.toLowerCase()
    const lowerLabel = command.label.toLowerCase()

    // Exact match (highest score)
    if (lowerLabel === lowerQuery) {
      return 100
    }

    // Starts with (high score)
    if (lowerLabel.startsWith(lowerQuery)) {
      return 90
    }

    // Contains (medium score)
    if (lowerLabel.includes(lowerQuery)) {
      return 70
    }

    // Check keywords if present
    if (command.keywords) {
      for (const keyword of command.keywords) {
        const lowerKeyword = keyword.toLowerCase()
        if (lowerKeyword === lowerQuery) {
          return 80
        }
        if (lowerKeyword.includes(lowerQuery)) {
          return 60
        }
      }
    }

    // Fuzzy match (all chars appear in order)
    let queryIndex = 0
    for (let i = 0; i < lowerLabel.length && queryIndex < lowerQuery.length; i++) {
      if (lowerLabel[i] === lowerQuery[queryIndex]) {
        queryIndex++
      }
    }

    if (queryIndex === lowerQuery.length) {
      return 50
    }

    // Check fuzzy in keywords too
    if (command.keywords) {
      for (const keyword of command.keywords) {
        const lowerKeyword = keyword.toLowerCase()
        let kQueryIndex = 0
        for (let i = 0; i < lowerKeyword.length && kQueryIndex < lowerQuery.length; i++) {
          if (lowerKeyword[i] === lowerQuery[kQueryIndex]) {
            kQueryIndex++
          }
        }
        if (kQueryIndex === lowerQuery.length) {
          return 40
        }
      }
    }

    return 0
  }

  private loadRecentCommands(): string[] {
    try {
      const stored = localStorage.getItem(RECENT_COMMANDS_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load recent commands:', error)
    }
    return []
  }

  private saveRecentCommands(): void {
    try {
      localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(this.recentCommandIds))
    } catch (error) {
      console.error('Failed to save recent commands:', error)
    }
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry()
