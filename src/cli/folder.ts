// Folder access prompt for CLI

import chalk from 'chalk'
import { selectOption } from './select'
import { state, WorkDirAccess } from './state'

export type FolderAccessResult = WorkDirAccess | 'clear' | null

const FOLDER_ACCESS_CHOICES = [
  { name: 'Read-write access', value: 'rw' as WorkDirAccess, description: 'AI can read and write files' },
  { name: 'Read-only access', value: 'ro' as WorkDirAccess, description: 'AI can read files in current folder' },
  { name: 'No filesystem access', value: 'none' as WorkDirAccess, description: 'AI cannot read or write files' }
]

const FOLDER_ACCESS_CHOICES_WITH_CLEAR = [
  ...FOLDER_ACCESS_CHOICES,
  { name: 'Clear saved preference', value: 'clear' as const, description: 'Remove saved setting for this folder' }
]

/**
 * Prompt user for folder access level
 * Returns the selected access level, or null if cancelled
 * @param includeClear - Whether to include the "clear" option (for /folder command)
 */
export async function promptFolderAccess(includeClear = false): Promise<FolderAccessResult> {
  const cwd = process.cwd()
  const folderName = cwd.length > 40 ? '…' + cwd.slice(-40) : cwd

  const choices = includeClear ? FOLDER_ACCESS_CHOICES_WITH_CLEAR : FOLDER_ACCESS_CHOICES

  const selectedAccess = await selectOption({
    title: `Grant AI access to ${chalk.white(folderName)}?`,
    choices
  })

  // If cancelled (empty string), return null
  if (!selectedAccess) {
    return null
  }

  return selectedAccess as FolderAccessResult
}

/**
 * Apply folder access settings to state
 */
export function applyFolderAccess(access: WorkDirAccess): void {
  state.workDir = {
    path: access === 'none' ? null : process.cwd(),
    access
  }
}

/**
 * Get display label for current access level
 */
export function getFolderAccessLabel(): string {
  const choice = FOLDER_ACCESS_CHOICES.find(c => c.value === state.workDir.access)
  return choice?.name || 'No filesystem access'
}
