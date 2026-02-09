
import { App } from 'electron'
import { listAgents, saveAgent } from '../agents'
import { listWorkspaces } from '../workspace'
import { loadHistory, saveHistory } from '../history'
import { loadSettings, saveSettings } from '../config'
import { LEGACY_SUFFIX_PATTERN } from '../mcp'

const MIGRATION_ID = 'mcp-tool-suffix-removal-v1'

/**
 * Strip the old ___xxxx suffix from a tool name
 */
export const stripOldToolSuffix = (toolName: string): string => {
  return toolName.replace(LEGACY_SUFFIX_PATTERN, '')
}

/**
 * Check if a tool name has the old ___xxxx suffix
 */
export const hasOldToolSuffix = (toolName: string): boolean => {
  return LEGACY_SUFFIX_PATTERN.test(toolName)
}

/**
 * Escape special regex characters in a string
 */
const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalize tool names in a prompt string by replacing old ___xxxx suffixes
 * For each tool in the tools array, finds occurrences of tool___xxxx in the prompt
 * and replaces them with just the tool name.
 */
export const normalizePromptToolNames = (
  prompt: string | null | undefined,
  tools: string[] | null | undefined
): string | null | undefined => {
  if (!prompt || !tools || tools.length === 0) {
    return prompt
  }

  let normalizedPrompt = prompt
  for (const tool of tools) {
    // Build a regex that matches tool___xxxx (exactly 4 chars after ___)
    // Use word boundary at the start to avoid matching partial tool names
    const escapedTool = escapeRegExp(tool)
    const pattern = new RegExp(`\\b${escapedTool}___....`, 'g')
    normalizedPrompt = normalizedPrompt.replace(pattern, tool)
  }

  return normalizedPrompt
}

/**
 * Migrate a tools array, returning the migrated array and count
 */
const migrateToolsArray = (tools: string[] | null | undefined): { tools: string[] | null; count: number } => {
  if (!tools || tools.length === 0) {
    return { tools: tools ?? null, count: 0 }
  }
  let count = 0
  const migratedTools = tools.map(tool => {
    if (hasOldToolSuffix(tool)) {
      count++
      return stripOldToolSuffix(tool)
    }
    return tool
  })
  return { tools: migratedTools, count }
}

/**
 * Migrate all tool references in a workspace to remove old ___xxxx suffixes
 * This includes:
 * - Agent steps (step.tools[])
 * - Chats (chat.tools[])
 * - Folder defaults (folder.defaults.tools[])
 *
 * Returns the number of tool references that were migrated
 */
export const migrateWorkspaceMcpToolNames = async (app: App, workspaceId: string): Promise<number> => {
  let migratedCount = 0

  // Migrate agents
  const agents = listAgents(app, workspaceId)
  for (const agent of agents) {
    let agentModified = false

    for (const step of agent.steps) {
      const result = migrateToolsArray(step.tools)
      if (result.count > 0) {
        step.tools = result.tools
        agentModified = true
        migratedCount += result.count
        // Normalize prompt to replace old tool name references
        if (step.prompt && result.tools) {
          step.prompt = normalizePromptToolNames(step.prompt, result.tools) ?? step.prompt
        }
      }
    }

    if (agentModified) {
      saveAgent(app, workspaceId, agent)
      console.log(`[migration] Migrated agent ${agent.uuid} in workspace ${workspaceId}`)
    }
  }

  // Migrate history (chats and folder defaults)
  const history = await loadHistory(app, workspaceId)
  let historyModified = false

  // Migrate chats
  if (history?.chats) {
    for (const chat of history.chats) {
      const result = migrateToolsArray(chat.tools)
      if (result.count > 0) {
        chat.tools = result.tools
        historyModified = true
        migratedCount += result.count
      }
    }
  }

  // Migrate folder defaults
  if (history?.folders) {
    for (const folder of history.folders) {
      if (folder.defaults?.tools) {
        const result = migrateToolsArray(folder.defaults.tools)
        if (result.count > 0) {
          folder.defaults.tools = result.tools
          historyModified = true
          migratedCount += result.count
        }
      }
    }
  }

  if (historyModified) {
    saveHistory(app, workspaceId, history)
    console.log(`[migration] Migrated history in workspace ${workspaceId}`)
  }

  return migratedCount
}

/**
 * Check if migration has already been completed
 */
export const isMigrationCompleted = (app: App): boolean => {
  const config = loadSettings(app)
  if (config.migrations?.includes(MIGRATION_ID)) {
    return true
  }
  return false
}

/**
 * Mark migration as completed
 */
export const markMigrationCompleted = (app: App): void => {
  const config = loadSettings(app)
  if (!config.migrations) {
    config.migrations = []
  }
  config.migrations.push(MIGRATION_ID)
  saveSettings(app, config, true)
}

/**
 * Migrate global settings to remove old ___xxxx suffixes from tool names
 * This includes:
 * - llm.defaults[].tools (model defaults)
 * - prompt.tools (scratchpad)
 * - realtime.tools (voice mode)
 */
const migrateSettingsMcpToolNames = (app: App): number => {
  let migratedCount = 0
  const settings = loadSettings(app)
  let settingsModified = false

  // Migrate llm.defaults[].tools
  if (settings.llm?.defaults) {
    for (const modelDefault of settings.llm.defaults) {
      if (modelDefault.tools) {
        const result = migrateToolsArray(modelDefault.tools)
        if (result.count > 0) {
          modelDefault.tools = result.tools
          settingsModified = true
          migratedCount += result.count
        }
      }
    }
  }

  // Migrate prompt.tools (scratchpad)
  if (settings.prompt?.tools) {
    const result = migrateToolsArray(settings.prompt.tools)
    if (result.count > 0) {
      settings.prompt.tools = result.tools
      settingsModified = true
      migratedCount += result.count
    }
  }

  // Migrate realtime.tools
  if (settings.realtime?.tools) {
    const result = migrateToolsArray(settings.realtime.tools)
    if (result.count > 0) {
      settings.realtime.tools = result.tools
      settingsModified = true
      migratedCount += result.count
    }
  }

  if (settingsModified) {
    saveSettings(app, settings, true)
    console.log(`[migration] Migrated global settings`)
  }

  return migratedCount
}

/**
 * Migrate all workspaces and global settings to remove old ___xxxx suffixes from tool names
 * Only runs once - checks metadata to see if already completed
 * Returns the total number of tool references that were migrated, or -1 if skipped
 */
export const migrateMcpToolNames = async (app: App): Promise<number> => {
  
  // Check if already migrated
  if (isMigrationCompleted(app)) {
    return -1
  }

  let totalMigrated = 0

  // Migrate global settings first
  totalMigrated += migrateSettingsMcpToolNames(app)

  // Migrate each workspace
  const workspaces = listWorkspaces(app)
  for (const workspace of workspaces) {
    const migrated = await migrateWorkspaceMcpToolNames(app, workspace.uuid)
    totalMigrated += migrated
  }

  // Mark as completed
  markMigrationCompleted(app)

  if (totalMigrated > 0) {
    console.log(`[migration] Total MCP tool name migrations: ${totalMigrated}`)
  } else {
    console.log(`[migration] MCP tool name migration completed (no changes needed)`)
  }

  return totalMigrated
}
