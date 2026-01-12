import { app, dialog } from 'electron'
import { beforeEach, expect, test, vi, Mock } from 'vitest'
import { parseMarkdownChat, importMarkdown } from '@main/import_md'

vi.mock('@main/i18n', () => ({
  getLocaleMessages: () => ({
    en: {
      chat: {
        role: {
          system: 'System',
          user: 'You',
          assistant: 'Assistant'
        }
      }
    },
    fr: {
      chat: {
        role: {
          system: 'Système',
          user: 'Vous',
          assistant: 'Assistant'
        }
      }
    },
    es: {
      chat: {
        role: {
          system: 'Sistema',
          user: 'Tú',
          assistant: 'Asistente'
        }
      }
    }
  }),
  useI18n: () => (key: string, params?: any) => {
    if (params) return `${key}: ${JSON.stringify(params)}`
    return key
  }
}))

vi.mock('@main/file', () => ({
  pickFile: vi.fn()
}))

vi.mock('@main/history', () => ({
  loadHistory: vi.fn(() => Promise.resolve({ chats: [] })),
  saveHistory: vi.fn()
}))

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn()
  }
}))

vi.mock('electron', async () => {
  return {
    app: {
      getPath: vi.fn(() => '/tmp'),
      getLocale: vi.fn(() => 'en-US'),
    },
    dialog: {
      showMessageBox: vi.fn(() => Promise.resolve({ response: 0 }))
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('parseMarkdownChat should parse English markdown correctly', () => {
  const markdown = `# Test Chat

## System

This is a system message.

## You

This is a user message.

## Assistant

This is an assistant response.
`

  const chat = parseMarkdownChat(app, markdown)

  expect(chat.title).toBe('Test Chat')
  expect(chat.messages).toHaveLength(3)
  expect(chat.messages[0].role).toBe('system')
  expect(chat.messages[0].content).toBe('This is a system message.')
  expect(chat.messages[1].role).toBe('user')
  expect(chat.messages[1].content).toBe('This is a user message.')
  expect(chat.messages[2].role).toBe('assistant')
  expect(chat.messages[2].content).toBe('This is an assistant response.')
})

test('parseMarkdownChat should parse French markdown correctly', () => {
  const markdown = `# Chat de Test

## Système

Ceci est un message système.

## Vous

Ceci est un message utilisateur.

## Assistant

Ceci est une réponse de l'assistant.
`

  const chat = parseMarkdownChat(app, markdown)

  expect(chat.title).toBe('Chat de Test')
  expect(chat.messages).toHaveLength(3)
  expect(chat.messages[0].role).toBe('system')
  expect(chat.messages[1].role).toBe('user')
  expect(chat.messages[2].role).toBe('assistant')
})

test('parseMarkdownChat should parse Spanish markdown correctly', () => {
  const markdown = `# Chat de Prueba

## Sistema

Este es un mensaje del sistema.

## Tú

Este es un mensaje del usuario.

## Asistente

Esta es una respuesta del asistente.
`

  const chat = parseMarkdownChat(app, markdown)

  expect(chat.title).toBe('Chat de Prueba')
  expect(chat.messages).toHaveLength(3)
  expect(chat.messages[0].role).toBe('system')
  expect(chat.messages[1].role).toBe('user')
  expect(chat.messages[2].role).toBe('assistant')
})

test('parseMarkdownChat should handle multi-line messages', () => {
  const markdown = `# Multi-line Test

## System

Line 1
Line 2
Line 3

## You

User line 1
User line 2

## Assistant

Assistant line 1
Assistant line 2
Assistant line 3
`

  const chat = parseMarkdownChat(app, markdown)

  expect(chat.messages[0].content).toBe('Line 1\nLine 2\nLine 3')
  expect(chat.messages[1].content).toBe('User line 1\nUser line 2')
  expect(chat.messages[2].content).toBe('Assistant line 1\nAssistant line 2\nAssistant line 3')
})

test('parseMarkdownChat should throw error for missing title', () => {
  const markdown = `## System

Test message
`

  expect(() => parseMarkdownChat(app, markdown)).toThrow('No title found')
})

test('parseMarkdownChat should throw error when no valid role found', () => {
  const markdown = `# Test

## Unknown Role

Test message

## Another Unknown

More content
`

  // The first H2 "Unknown Role" is not a valid role
  expect(() => parseMarkdownChat(app, markdown)).toThrow('First section after title must be a valid role')
})

test('parseMarkdownChat should throw error for no messages', () => {
  const markdown = `# Test Chat

Some content without role headers.
`

  expect(() => parseMarkdownChat(app, markdown)).toThrow('No valid role found after title')
})

test('parseMarkdownChat should preserve H1 headers in message content', () => {
  const markdown = `# Test Chat

## System

This is a message with a heading.

# This is H1 in content

More content after H1.

## You

User message
`

  const chat = parseMarkdownChat(app, markdown)

  expect(chat.messages[0].content).toContain('# This is H1 in content')
  expect(chat.messages[0].content).toContain('This is a message with a heading.')
  expect(chat.messages[0].content).toContain('More content after H1.')
})

test('parseMarkdownChat should preserve H2 headers in message content when not a role', () => {
  const markdown = `# Test Chat

## System

System message

## Assistant

Here's some code:

## Example Code

This is not a role, it's content.

## Another Section

More content here.

## You

User reply
`

  const chat = parseMarkdownChat(app, markdown)

  expect(chat.messages).toHaveLength(3)
  expect(chat.messages[0].role).toBe('system')
  expect(chat.messages[1].role).toBe('assistant')
  expect(chat.messages[1].content).toContain('## Example Code')
  expect(chat.messages[1].content).toContain('## Another Section')
  expect(chat.messages[2].role).toBe('user')
})

test('parseMarkdownChat should throw error when first H2 is not a valid role', () => {
  const markdown = `# Test Chat

## System2

This is content but System2 is not a valid role.
`

  // System2 is not a valid role
  expect(() => parseMarkdownChat(app, markdown)).toThrow('First section after title must be a valid role')
  expect(() => parseMarkdownChat(app, markdown)).toThrow('System2')
})

test('parseMarkdownChat should handle complex markdown with multiple header levels', () => {
  const markdown = `# Python Code Example

## System

You are a helpful assistant.

# H1 Header

## H2 Header

Structure & Formatting:
- Always start with a short introduction

## You

Can you write some python?

## Assistant

Absolutely! Here's an example:

## Example: Python Basics

\`\`\`python
def greet(name):
    print(f"Hello, {name}!")
\`\`\`

## What this code does:
- Defines a function
- Prints a greeting
`

  const chat = parseMarkdownChat(app, markdown)

  expect(chat.title).toBe('Python Code Example')
  expect(chat.messages).toHaveLength(3)

  // System message should contain H1 and H2 headers
  expect(chat.messages[0].role).toBe('system')
  expect(chat.messages[0].content).toContain('# H1 Header')
  expect(chat.messages[0].content).toContain('## H2 Header')
  expect(chat.messages[0].content).toContain('Structure & Formatting')

  // User message
  expect(chat.messages[1].role).toBe('user')
  expect(chat.messages[1].content).toBe('Can you write some python?')

  // Assistant message should contain content headers
  expect(chat.messages[2].role).toBe('assistant')
  expect(chat.messages[2].content).toContain('## Example: Python Basics')
  expect(chat.messages[2].content).toContain('## What this code does:')
})

// Tests for importMarkdown function
import { pickFile } from '@main/file'
import { loadHistory, saveHistory } from '@main/history'
import fs from 'fs'

test('importMarkdown returns null when no file is selected', async () => {
  (pickFile as Mock).mockReturnValue(null)

  const result = await importMarkdown(app)

  expect(result).toBeNull()
})

test('importMarkdown returns null when empty array is selected', async () => {
  (pickFile as Mock).mockReturnValue([])

  const result = await importMarkdown(app)

  expect(result).toBeNull()
})

test('importMarkdown imports single file without workspaceId', async () => {
  const markdown = `# Test Chat

## System

System message

## You

User message
`
  ;(pickFile as Mock).mockReturnValue(['/test/file.md'])
  ;(fs.readFileSync as Mock).mockReturnValue(markdown)

  const result = await importMarkdown(app)

  expect(result).not.toBeNull()
  expect(result?.title).toBe('Test Chat')
  expect(result?.messages).toHaveLength(2)
})

test('importMarkdown imports base64 encoded file', async () => {
  const markdown = `# Base64 Chat

## You

Hello!

## Assistant

Hi there!
`
  const base64Content = Buffer.from(markdown).toString('base64')
  ;(pickFile as Mock).mockReturnValue(['/test/file.md'])
  ;(fs.readFileSync as Mock).mockReturnValue(base64Content)

  const result = await importMarkdown(app)

  expect(result).not.toBeNull()
  expect(result?.title).toBe('Base64 Chat')
})

test('importMarkdown imports multiple files with workspaceId', async () => {
  const markdown1 = `# Chat 1

## You

Message 1
`
  const markdown2 = `# Chat 2

## Assistant

Message 2
`
  ;(pickFile as Mock).mockReturnValue(['/test/file1.md', '/test/file2.md'])
  ;(fs.readFileSync as Mock)
    .mockReturnValueOnce(markdown1)
    .mockReturnValueOnce(markdown2)
  ;(loadHistory as Mock).mockResolvedValue({ chats: [] })

  const result = await importMarkdown(app, 'workspace-123')

  expect(result).toBeNull() // Returns null for multi-file import
  expect(saveHistory).toHaveBeenCalled()
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'info'
    })
  )
})

test('importMarkdown shows error dialog for invalid file with workspaceId', async () => {
  const invalidMarkdown = `Invalid content without proper headers`
  ;(pickFile as Mock).mockReturnValue(['/test/file.md', '/test/file2.md'])
  ;(fs.readFileSync as Mock).mockReturnValue(invalidMarkdown)
  ;(loadHistory as Mock).mockResolvedValue({ chats: [] })

  await importMarkdown(app, 'workspace-123')

  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'error'
    })
  )
})

test('importMarkdown handles mixed success and failure', async () => {
  const validMarkdown = `# Valid Chat

## You

Hello
`
  const invalidMarkdown = `No title or headers`
  ;(pickFile as Mock).mockReturnValue(['/test/valid.md', '/test/invalid.md'])
  ;(fs.readFileSync as Mock)
    .mockReturnValueOnce(validMarkdown)
    .mockReturnValueOnce(invalidMarkdown)
  ;(loadHistory as Mock).mockResolvedValue({ chats: [] })

  await importMarkdown(app, 'workspace-123')

  expect(saveHistory).toHaveBeenCalled()
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'warning'
    })
  )
})

test('importMarkdown handles empty file', async () => {
  ;(pickFile as Mock).mockReturnValue(['/test/empty.md'])
  ;(fs.readFileSync as Mock).mockReturnValue('')
  ;(loadHistory as Mock).mockResolvedValue({ chats: [] })

  await importMarkdown(app, 'workspace-123')

  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'error'
    })
  )
})

test('importMarkdown single file with workspaceId shows success dialog', async () => {
  const markdown = `# Single Chat

## You

Hello!
`
  ;(pickFile as Mock).mockReturnValue('/test/file.md')
  ;(fs.readFileSync as Mock).mockReturnValue(markdown)
  ;(loadHistory as Mock).mockResolvedValue({ chats: [] })

  await importMarkdown(app, 'workspace-123')

  expect(saveHistory).toHaveBeenCalled()
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'info'
    })
  )
})
