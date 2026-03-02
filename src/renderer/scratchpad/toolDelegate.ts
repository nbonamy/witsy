
import { PluginTool, ToolExecutionDelegate } from 'multi-llm-ts'

type ReplaceEdit = {
  old_string: string
  new_string: string
  occurrence?: number // 1-indexed, -1 = all. omit only if text appears once
}

type InsertEdit = {
  position: number // 0 = beginning, -1 = end, else after line N
  content: string
}

type EditOperation = ReplaceEdit | InsertEdit

function isReplaceEdit(edit: EditOperation): edit is ReplaceEdit {
  return 'old_string' in edit
}

function isInsertEdit(edit: EditOperation): edit is InsertEdit {
  return 'position' in edit
}

function applyReplacement(text: string, edit: ReplaceEdit): string {
  const { old_string, new_string, occurrence } = edit

  // replace all
  if (occurrence === -1) {
    return text.split(old_string).join(new_string)
  }

  // find the target occurrence (1-indexed, default first)
  const target = occurrence ?? 1
  let count = 0
  let pos = 0

  while ((pos = text.indexOf(old_string, pos)) !== -1) {
    count++
    if (count === target) {
      return text.slice(0, pos) + new_string + text.slice(pos + old_string.length)
    }
    pos += old_string.length
  }

  return text
}

function applyInsert(text: string, edit: InsertEdit): string {
  const { position, content } = edit

  // beginning
  if (position === 0) {
    return content + '\n' + text
  }

  // end
  if (position === -1) {
    return text + '\n' + content
  }

  // after line N
  const lines = text.split('\n')
  const clampedLine = Math.min(position, lines.length)
  lines.splice(clampedLine, 0, content)
  return lines.join('\n')
}

export function applyEdits(text: string, edits: EditOperation[]): string {

  // separate inserts and replacements
  const inserts = edits.filter(isInsertEdit)
  const replacements = edits.filter(isReplaceEdit)

  // apply inserts first (highest position to lowest to preserve line numbers)
  // but -1 (end) should be applied last among inserts
  const sortedInserts = [...inserts].sort((a, b) => {
    if (a.position === -1) return 1
    if (b.position === -1) return -1
    return b.position - a.position
  })

  let result = text
  for (const insert of sortedInserts) {
    result = applyInsert(result, insert)
  }

  // then apply replacements in order
  for (const replacement of replacements) {
    result = applyReplacement(result, replacement)
  }

  return result
}

// validate edits before applying
export function validateEdits(text: string, edits: EditOperation[]): string | null {
  for (const edit of edits) {
    if (isReplaceEdit(edit)) {
      const count = text.split(edit.old_string).length - 1
      if (count === 0) {
        return `Text not found: "${edit.old_string.slice(0, 50)}${edit.old_string.length > 50 ? '…' : ''}"`
      }
      if (count > 1 && edit.occurrence === undefined) {
        return `Text "${edit.old_string.slice(0, 50)}${edit.old_string.length > 50 ? '…' : ''}" appears ${count} times. Specify occurrence (1-indexed) or -1 for all.`
      }
      if (edit.occurrence !== undefined && edit.occurrence !== -1 && edit.occurrence > count) {
        return `Requested occurrence ${edit.occurrence} but text only appears ${count} time(s).`
      }
    } else if (isInsertEdit(edit)) {
      if (edit.position !== 0 && edit.position !== -1) {
        const lineCount = text.split('\n').length
        if (edit.position > lineCount) {
          return `Insert position ${edit.position} exceeds document line count (${lineCount}).`
        }
      }
    }
  }
  return null
}

const replaceSelectionTool: PluginTool = {
  name: 'replace_selection',
  description: 'Replace the selected text with new content. You MUST use this tool to modify the document.',
  parameters: [{
    name: 'content',
    type: 'string',
    description: 'The new content to replace the selection with (markdown)',
    required: true,
  }],
}

const editTool: PluginTool = {
  name: 'edit_document',
  description: 'Apply search-and-replace edits to the document. Use this for targeted modifications (fix typos, rephrase sentences, update specific sections). Each edit finds exact text and replaces it.',
  parameters: [{
    name: 'edits',
    type: 'array',
    description: 'Array of edit operations. Each edit: { old_string: "text to find", new_string: "replacement text", occurrence?: number (1=first, 2=second, -1=all; omit only if text appears once) }',
    required: true,
    items: {
      type: 'object',
      properties: [
        { name: 'old_string', type: 'string', description: 'The exact text to find in the document', required: true },
        { name: 'new_string', type: 'string', description: 'The replacement text', required: true },
        { name: 'occurrence', type: 'number', description: 'Which occurrence to replace (1-indexed, -1 for all). Omit if the text appears only once.' },
      ],
    },
  }],
}

const insertTool: PluginTool = {
  name: 'insert_content',
  description: 'Insert new content at a specific position in the document. Use this to add new sections, paragraphs, or text without modifying existing content. Position: 0 = beginning, -1 = end, N = after line N.',
  parameters: [{
    name: 'position',
    type: 'number',
    description: 'Where to insert: 0 = beginning of document, -1 = end of document, N = after line N',
    required: true,
  }, {
    name: 'content',
    type: 'string',
    description: 'The content to insert (markdown)',
    required: true,
  }],
}

type ScratchpadToolDelegateCallbacks = {
  getContent: () => string
  setContent: (content: string) => void
  replaceSelection: (content: string) => void
}

export function buildScratchpadToolDelegate(
  hasSelection: boolean,
  callbacks: ScratchpadToolDelegateCallbacks,
): ToolExecutionDelegate {

  return {

    getTools: () => {
      if (hasSelection) {
        return [replaceSelectionTool]
      }
      return [editTool, insertTool]
    },

    execute: async (_context, tool, args) => {

      if (tool === 'replace_selection') {
        callbacks.replaceSelection(args.content)
        return { success: true }
      }

      if (tool === 'edit_document') {
        const content = callbacks.getContent()
        const edits: EditOperation[] = args.edits
        const error = validateEdits(content, edits)
        if (error) {
          return { success: false, error }
        }
        const newContent = applyEdits(content, edits)
        callbacks.setContent(newContent)
        return { success: true, editsApplied: edits.length }
      }

      if (tool === 'insert_content') {
        const content = callbacks.getContent()
        const edit: InsertEdit = { position: args.position, content: args.content }
        const error = validateEdits(content, [edit])
        if (error) {
          return { success: false, error }
        }
        const newContent = applyEdits(content, [edit])
        callbacks.setContent(newContent)
        return { success: true }
      }

      return { success: false, error: `Unknown tool: ${tool}` }
    },

  }
}
