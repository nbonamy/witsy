// Folder access prompt for CLI

import chalk from 'chalk'
import { selectOption } from './select'
import { state, WorkDirAccess } from './state'

const FOLDER_ACCESS_CHOICES = [
  { name: 'No filesystem access', value: 'none' as WorkDirAccess, description: 'AI cannot read or write files' },
  { name: 'Read-only access', value: 'ro' as WorkDirAccess, description: 'AI can read files in current folder' },
  { name: 'Read-write access', value: 'rw' as WorkDirAccess, description: 'AI can read and write files' }
]

/**
 * Prompt user for folder access level
 * Returns the selected access level or 'none' if cancelled
 */
export async function promptFolderAccess(): Promise<WorkDirAccess> {
  const cwd = process.cwd()

  console.log(chalk.dim(`\n  Current folder: ${cwd}\n`))

  const selectedAccess = await selectOption({
    title: 'Grant AI access to current folder?',
    choices: FOLDER_ACCESS_CHOICES
  })

  // If cancelled (empty string), default to 'none'
  if (!selectedAccess) {
    return 'none'
  }

  return selectedAccess
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
