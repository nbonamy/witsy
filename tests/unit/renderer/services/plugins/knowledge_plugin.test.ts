
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import KnowledgePlugin from '../../src/renderer/services/plugins/knowledge'
import { DocumentBase } from '../../src/types/rag'

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const mockDocRepos: DocumentBase[] = [
  {
    uuid: 'repo1',
    name: 'Technical Docs',
    description: 'Contains all technical documentation and API references',
    embeddingEngine: 'openai',
    embeddingModel: 'text-embedding-ada-002',
    workspaceId: 'workspace1',
    documents: []
  },
  {
    uuid: 'repo2',
    name: 'Marketing Materials',
    description: 'Marketing collateral, presentations, and case studies',
    embeddingEngine: 'openai',
    embeddingModel: 'text-embedding-ada-002',
    workspaceId: 'workspace1',
    documents: []
  },
  {
    uuid: 'repo3',
    name: 'No Description Repo',
    embeddingEngine: 'openai',
    embeddingModel: 'text-embedding-ada-002',
    workspaceId: 'workspace1',
    documents: []
  },
  {
    uuid: 'repo4',
    name: 'Empty Description Repo',
    description: '   ',
    embeddingEngine: 'openai',
    embeddingModel: 'text-embedding-ada-002',
    workspaceId: 'workspace1',
    documents: []
  },
  {
    uuid: 'repo5',
    name: 'Other Workspace Repo',
    description: 'This repo belongs to a different workspace',
    embeddingEngine: 'openai',
    embeddingModel: 'text-embedding-ada-002',
    workspaceId: 'workspace2',
    documents: []
  }
]

test('Plugin name is correct', () => {
  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  expect(plugin.getName()).toBe('Knowledge Base Access')
})

test('getTools returns tools only for docrepos with descriptions in current workspace', async () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const tools = await plugin.getTools()

  expect(tools).toHaveLength(2) // Only repo1 and repo2 have valid descriptions
  expect(tools[0].function.name).toBe('search_knowledge_repo1')
  expect(tools[0].function.description).toBe('Allows to search: Contains all technical documentation and API references')
  expect(tools[1].function.name).toBe('search_knowledge_repo2')
  expect(tools[1].function.description).toBe('Allows to search: Marketing collateral, presentations, and case studies')
})

test('getTools excludes docrepos without descriptions', async () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const tools = await plugin.getTools()

  const toolNames = tools.map(t => t.function.name)
  expect(toolNames).not.toContain('search_knowledge_repo3') // No description
  expect(toolNames).not.toContain('search_knowledge_repo4') // Empty/whitespace description
})

test('getTools excludes docrepos from other workspaces', async () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const tools = await plugin.getTools()

  const toolNames = tools.map(t => t.function.name)
  expect(toolNames).not.toContain('search_knowledge_repo5') // Different workspace
})

test('getTools respects toolsEnabled filter', async () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  plugin.toolsEnabled = ['search_knowledge_repo1']

  const tools = await plugin.getTools()

  expect(tools).toHaveLength(1)
  expect(tools[0].function.name).toBe('search_knowledge_repo1')
})

test('handlesTool returns true for valid knowledge tool', () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  expect(plugin.handlesTool('search_knowledge_repo1')).toBe(true)
  expect(plugin.handlesTool('search_knowledge_repo2')).toBe(true)
})

test('handlesTool returns false for docrepo without description', () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  expect(plugin.handlesTool('search_knowledge_repo3')).toBe(false) // No description
  expect(plugin.handlesTool('search_knowledge_repo4')).toBe(false) // Empty description
})

test('handlesTool returns false for docrepo from other workspace', () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  expect(plugin.handlesTool('search_knowledge_repo5')).toBe(false) // Different workspace
})

test('handlesTool returns false for non-knowledge tools', () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  expect(plugin.handlesTool('other_tool')).toBe(false)
  expect(plugin.handlesTool('search_internet')).toBe(false)
})

test('handlesTool returns false for invalid UUID', () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  expect(plugin.handlesTool('search_knowledge_invalid')).toBe(false)
})

test('handlesTool respects toolsEnabled filter', () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  plugin.toolsEnabled = ['search_knowledge_repo1']

  expect(plugin.handlesTool('search_knowledge_repo1')).toBe(true)
  expect(plugin.handlesTool('search_knowledge_repo2')).toBe(false) // Not in toolsEnabled
})

test('execute calls docrepo.query with correct parameters', async () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)
  window.api.docrepo.query = vi.fn().mockResolvedValue([
    { content: 'Result 1', score: 0.95, metadata: { title: 'Doc 1' } },
    { content: 'Result 2', score: 0.85, metadata: { url: 'http://example.com' } }
  ])

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const result = await plugin.execute({} as any, {
    tool: 'search_knowledge_repo1',
    parameters: { query: 'test query' }
  })

  expect(window.api.docrepo.query).toHaveBeenCalledWith('repo1', 'test query')
  expect(result.items).toHaveLength(2)
  expect(result.items[0]).toEqual({
    content: 'Result 1',
    score: 0.95,
    source: 'Doc 1'
  })
  expect(result.items[1]).toEqual({
    content: 'Result 2',
    score: 0.85,
    source: 'http://example.com'
  })
})

test('execute returns error for unhandled tool', async () => {
  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const result = await plugin.execute({} as any, {
    tool: 'invalid_tool',
    parameters: { query: 'test' }
  })

  expect(result.error).toBeDefined()
  expect(result.error).toContain('not handled by this plugin')
})

test('execute returns error when query fails', async () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)
  window.api.docrepo.query = vi.fn().mockRejectedValue(new Error('Query failed'))

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const result = await plugin.execute({} as any, {
    tool: 'search_knowledge_repo1',
    parameters: { query: 'test query' }
  })

  expect(result.error).toBe('Query failed')
})

test('execute uses origin as fallback for source when title and url are missing', async () => {
  window.api.docrepo.list = vi.fn().mockReturnValue(mockDocRepos)
  window.api.docrepo.query = vi.fn().mockResolvedValue([
    { content: 'Result', score: 0.9, metadata: { origin: '/path/to/file.txt' } }
  ])

  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const result = await plugin.execute({} as any, {
    tool: 'search_knowledge_repo1',
    parameters: { query: 'test' }
  })

  expect(result.items[0].source).toBe('/path/to/file.txt')
})

test('getPreparationDescription returns correct message', () => {
  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const desc = plugin.getPreparationDescription('search_knowledge_repo1')
  // In test environment, i18n returns the key rather than interpolated message
  expect(desc).toBe('plugins.knowledge.preparing')
})

test('getRunningDescription returns correct message with query', () => {
  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const desc = plugin.getRunningDescription('search_knowledge_repo1', { query: 'test query' })
  // In test environment, i18n returns the key rather than interpolated message
  expect(desc).toBe('plugins.knowledge.running')
})

test('getCompletedDescription returns error message when error exists', () => {
  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const desc = plugin.getCompletedDescription('search_knowledge_repo1', {}, { error: 'Something went wrong' })
  // In test environment, i18n returns the key rather than interpolated message
  expect(desc).toBe('plugins.knowledge.error')
})

test('getCompletedDescription returns count when successful', () => {
  const plugin = new KnowledgePlugin({ enabled: true }, 'workspace1')
  const desc = plugin.getCompletedDescription('search_knowledge_repo1', {}, { items: [{}, {}, {}] })
  // In test environment, i18n returns the key rather than interpolated message
  expect(desc).toBe('plugins.knowledge.completed')
})
