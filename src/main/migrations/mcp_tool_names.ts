
import { App } from 'electron'
import { loadSettings, saveSettings } from '../config'

/**
 * Regex to match old UUID suffix pattern: ___xxxx (exactly 4 chars after ___)
 * Examples: tool___90ab, list_files___1234
 */
const OLD_SUFFIX_PATTERN = /___....$/

/**
 * Strip the old ___xxxx suffix from a tool name
 */
export const stripOldToolSuffix = (toolName: string): string => {
  return toolName.replace(OLD_SUFFIX_PATTERN, '')
}

/**
 * Check if a tool name has the old ___xxxx suffix
 */
export const hasOldToolSuffix = (toolName: string): boolean => {
  return OLD_SUFFIX_PATTERN.test(toolName)
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
 * Migrate global settings to remove old ___xxxx suffixes from tool names
 * This includes:
 * - llm.defaults[].tools (model defaults)
 * - prompt.tools (scratchpad)
 * - realtime.tools (voice mode)
 */
export const migrateSettingsMcpToolNames = (app: App): number => {
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
