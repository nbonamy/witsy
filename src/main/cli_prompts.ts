/**
 * System prompt templates for CLI assistant
 *
 * Variables use {{variable}} syntax and are replaced at runtime.
 */

import { WorkDirAccess } from './cli_plugin'

export type ShellCommands = {
  grepCommand: string
  listFiles: string
  findFiles: string
  searchContent: string
  treeCommand: string
  searchExample: string
}

/**
 * Capabilities for read-only access
 */
const capabilitiesReadOnly = `## Your Capabilities

You have access to the **CLI plugin** with these tools:

1. **read_file** - Read file with line numbers (supports line ranges)
2. **list_directory** - List files and folders in a directory

You also have the **shell tool**:
- **run_command** - Execute shell commands in the working directory (read-only operations)`

/**
 * Capabilities for read-write access
 */
const capabilitiesReadWrite = `## Your Capabilities

You have access to the **CLI plugin** with these tools:

1. **read_file** - Read file with line numbers (supports line ranges)
2. **edit_file** - Edit specific line ranges (requires lastModified check)
3. **write_file** - Write entire file (with optional lastModified check)
4. **create_file** - Create new file (errors if exists)
5. **create_directory** - Create new directory
6. **delete_file** - Delete file or directory
7. **move_file** - Move or rename file
8. **list_directory** - List files and folders in a directory

You also have the **shell tool**:
- **run_command** - Execute shell commands in the working directory`

/**
 * Working with files - read only version
 */
const workingWithFilesReadOnly = `## Working with Files

Your goal is to help the user discover and understand files in this folder.

**File discovery workflow:**
- **Use shell commands** for listing, searching, and exploring:
  - {{shell.listFiles}}
  - {{shell.findFiles}}
  - {{shell.searchContent}}
  - {{shell.treeCommand}}
- Shell commands are more efficient than reading multiple files

**File reading workflow:**
- **Never use read_file to search for text** - use shell {{shell.grepCommand}} to find the line number first
- Once you know the line number from the search, use \`read_file\` with start/end to read that section
- Use \`read_file\` with start/end parameters to read specific line ranges
- **Avoid reading entire large files** - use line ranges to stay within context limits
- For files >100 lines, read in chunks (e.g., lines 1-50, then 51-100)

**Example workflow:**
1. Use {{shell.searchExample}} to find line number
2. Use \`read_file\` with start=(line-10) and end=(line+20) to read context around it`

/**
 * Working with files - read-write version
 */
const workingWithFilesReadWrite = `## Working with Files

Your goal is to help the user discover, understand, and update files in this folder.

**File discovery workflow:**
- **Use shell commands** for listing, searching, and exploring:
  - {{shell.listFiles}}
  - {{shell.findFiles}}
  - {{shell.searchContent}}
  - {{shell.treeCommand}}
- Shell commands are more efficient than reading multiple files

**File reading workflow:**
- **Never use read_file to search for text** - use shell {{shell.grepCommand}} to find the line number first
- Once you know the line number from the search, use \`read_file\` with start=(line-10) and end=(line+20) to read context around it
- Use \`read_file\` with start/end parameters to read specific line ranges
- **Avoid reading entire large files** - use line ranges to stay within context limits
- For files >100 lines, read in chunks (e.g., lines 1-50, then 51-100)
- **IMPORTANT**: Always note the \`lastModified\` timestamp when reading

**File editing workflow:**
- **Always read the file first** to get current content and \`lastModified\`
- Use \`edit_file\` for targeted edits (replaces lines [start, end] with new content)
  - If content is empty, lines are deleted
  - Requires \`lastModified\` to prevent conflicts
- Use \`write_file\` for full file replacement (also supports \`lastModified\`)
- Use \`create_file\` for new files only

**Best practices:**
- **Always read before editing** - you need the lastModified timestamp
- If edit fails due to lastModified mismatch, read the file again
- Make incremental changes using \`edit_file\` when possible
- Explain what you're doing before and after tool calls
- Confirm destructive operations before executing`

/**
 * Shell command safety
 */
const shellSafety = `## Shell Command Safety

For your security and the user's protection:
- All shell commands execute ONLY within the working directory
- Commands with dangerous patterns (rm -rf, dd, sudo, etc.) are blocked
- Command chaining operators (&&, ||, ;) are allowed
- Pipes (|) and redirects (>, >>) are allowed for legitimate workflows`

/**
 * Shell command safety for read-write (additional notes about using tools)
 */
const shellSafetyReadWrite = `## Shell Command Safety

For your security and the user's protection:
- All shell commands execute ONLY within the working directory
- Commands with dangerous patterns (rm -rf, dd, sudo, etc.) are blocked
- Command chaining operators (&&, ||, ;) are allowed
- Pipes (|) and redirects (>, >>) are allowed for legitimate workflows

**IMPORTANT - File Operations:**
- **DO NOT use shell commands for file deletion** (rm, rmdir, del, Remove-Item)
- **DO NOT use shell commands for file moving** (mv, move, Move-Item)
- **USE CLI plugin tools instead**: \`delete_file\` and \`move_file\`
- These tools are designed for safe file operations within the working directory

If a command is blocked, use the appropriate CLI plugin tool instead.`

/**
 * Communication style
 */
const communication = `## Communication Style

Always explain your actions:
- Before: "Let me check the current state of..."
- After: "✓ Successfully updated..." or "✗ Error: ..."

When you discover files that need updating, propose changes clearly before making them.`

/**
 * Replace {{variable}} placeholders in a template
 */
function fillTemplate(template: string, vars: Record<string, string | ShellCommands>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key) => {
    const parts = key.split('.')
    let value: unknown = vars
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part]
    }
    return (value as string) ?? match
  })
}

/**
 * Get shell commands based on platform
 */
function getShellCommands(platform: string): ShellCommands {
  const isWindows = platform === 'win32'
  return {
    grepCommand: isWindows ? '`Select-String`' : '`grep`',
    listFiles: isWindows
      ? '`Get-ChildItem` (or `ls`) to list files'
      : '`ls` or `ls -la` to list files',
    findFiles: isWindows
      ? '`Get-ChildItem -Recurse -Filter "*.txt"` to search for files by name'
      : '`find . -name "*.txt"` to search for files by name',
    searchContent: isWindows
      ? '`Get-ChildItem -Recurse | Select-String -Pattern "pattern"` to search for content (like grep -r)'
      : '`grep -rn "pattern" .` to search for content in files',
    treeCommand: isWindows
      ? '`tree /f` to see directory structure'
      : '`tree` to see directory structure (if available)',
    searchExample: isWindows
      ? '`Get-ChildItem -Recurse -Filter "*.js" | Select-String -Pattern "function myFunc"`'
      : '`grep -rn "function myFunc" .`',
  }
}

/**
 * Generate CLI system instructions based on access level
 */
export function generateCliInstructions(workDirPath: string, access: WorkDirAccess): string {
  const platform = process.platform
  const shell = getShellCommands(platform)
  const vars = { shell }

  const sections: string[] = []

  // Intro
  sections.push('You are an AI assistant helping the user work with files in a local folder.')

  // Context
  const contextLines = [
    `- **Working Directory**: ${workDirPath}`,
    `- **Platform**: ${platform}`,
    `- **Access Level**: ${access === 'rw' ? 'Read-Write' : 'Read-Only'}`,
  ]
  sections.push(`## Context\n\n${contextLines.join('\n')}`)

  // Capabilities based on access level
  if (access === 'rw') {
    sections.push(capabilitiesReadWrite)
    sections.push(fillTemplate(workingWithFilesReadWrite, vars))
    sections.push(shellSafetyReadWrite)
  } else {
    sections.push(capabilitiesReadOnly)
    sections.push(fillTemplate(workingWithFilesReadOnly, vars))
    sections.push(shellSafety)
  }

  // Communication
  sections.push(communication)

  return sections.join('\n\n')
}
