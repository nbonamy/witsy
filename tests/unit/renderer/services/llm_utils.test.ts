import { LlmChunkTool } from 'multi-llm-ts'
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import defaults from '@root/defaults/settings.json'
import LlmUtils from '@services/llm_utils'
import Message from '@models/message'

let config = defaults as any

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
  config = JSON.parse(JSON.stringify(defaults))

  // Mock docrepo API
  window.api.docrepo = {
    list: vi.fn(() => [
      { uuid: 'repo1', name: 'Knowledge Base 1', workspaceId: 'workspace1' },
      { uuid: 'repo2', name: 'Knowledge Base 2', workspaceId: 'workspace1' },
    ]),
    query: vi.fn((uuid: string) => {
      if (uuid === 'repo1') {
        return Promise.resolve([
          { content: 'Content from repo1', score: 0.8, metadata: { uuid: '1', title: 'Doc A', type: 'text', url: 'url1' } },
          { content: 'More from repo1', score: 0.6, metadata: { uuid: '2', title: 'Doc B', type: 'text', url: 'url2' } },
        ])
      } else if (uuid === 'repo2') {
        return Promise.resolve([
          { content: 'Content from repo2', score: 0.9, metadata: { uuid: '3', title: 'Doc C', type: 'text', url: 'url3' } },
          { content: 'More from repo2', score: 0.5, metadata: { uuid: '4', title: 'Doc D', type: 'text', url: 'url4' } },
        ])
      }
      return Promise.resolve([])
    }),
  } as any
})

test('queryDocRepos returns empty for no docrepos', async () => {
  const result = await LlmUtils.queryDocRepos(config, [], 'test query')
  expect(result.sources).toEqual([])
  expect(result.context).toBe('instructions.chat.docrepoNoResults')
})

test('queryDocRepos returns no results message when query returns empty', async () => {
  window.api.docrepo.query = vi.fn(() => Promise.resolve([]))
  const result = await LlmUtils.queryDocRepos(config, ['repo1'], 'test query')
  expect(result.sources).toEqual([])
  expect(result.context).toBe('instructions.chat.docrepoNoResults')
})

test('queryDocRepos queries single docrepo', async () => {
  const result = await LlmUtils.queryDocRepos(config, ['repo1'], 'test query')

  expect(window.api.docrepo.query).toHaveBeenCalledTimes(1)
  expect(window.api.docrepo.query).toHaveBeenCalledWith('repo1', 'test query')
  expect(result.sources).toHaveLength(2)
})

test('queryDocRepos queries multiple docrepos in parallel', async () => {
  const result = await LlmUtils.queryDocRepos(config, ['repo1', 'repo2'], 'test query')

  expect(window.api.docrepo.query).toHaveBeenCalledTimes(2)
  expect(window.api.docrepo.query).toHaveBeenCalledWith('repo1', 'test query')
  expect(window.api.docrepo.query).toHaveBeenCalledWith('repo2', 'test query')
  expect(result.sources).toHaveLength(4)
})

test('queryDocRepos sorts results by RRF score', async () => {
  const result = await LlmUtils.queryDocRepos(config, ['repo1', 'repo2'], 'test query')

  // With RRF, rank within each source matters more than raw scores
  // repo1: [0.8 (rank 1), 0.6 (rank 2)]
  // repo2: [0.9 (rank 1), 0.5 (rank 2)]
  // RRF scores: rank 1 = 1/(60+1) ≈ 0.0164, rank 2 = 1/(60+2) ≈ 0.0161
  // Top-ranked items from each repo come first (tied RRF), then second-ranked items
  const rrfScores = result.sources.map(s => s.rrfScore)
  expect(rrfScores[0]).toBeCloseTo(1/61, 5) // rank 1 from first processed repo
  expect(rrfScores[1]).toBeCloseTo(1/61, 5) // rank 1 from second processed repo
  expect(rrfScores[2]).toBeCloseTo(1/62, 5) // rank 2
  expect(rrfScores[3]).toBeCloseTo(1/62, 5) // rank 2
})

test('queryDocRepos formats context with titles', async () => {
  const result = await LlmUtils.queryDocRepos(config, ['repo1', 'repo2'], 'test query')

  // Context should contain all sources with their titles
  expect(result.context).toContain('[Source: Doc A]')
  expect(result.context).toContain('Content from repo1')
  expect(result.context).toContain('[Source: Doc C]')
  expect(result.context).toContain('Content from repo2')
  expect(result.context).toContain('---')
})

test('queryDocRepos emits tool call status when callback provided', async () => {
  const statusCalls: LlmChunkTool[] = []
  const response = new Message('assistant', '')

  await LlmUtils.queryDocRepos(config, ['repo1', 'repo2'], 'test query', {
    response,
    onToolCallStatus: (toolCall) => statusCalls.push(toolCall)
  })

  // Should have 4 status calls: 2 running + 2 completed
  expect(statusCalls).toHaveLength(4)

  // First two should be running
  expect(statusCalls[0].state).toBe('running')
  expect(statusCalls[1].state).toBe('running')

  // Last two should be completed (order may vary due to parallel execution)
  const completedCalls = statusCalls.filter(c => c.state === 'completed')
  expect(completedCalls).toHaveLength(2)
  expect(completedCalls[0].call.result).toBeDefined()
  expect(completedCalls[1].call.result).toBeDefined()
})

test('queryDocRepos adds tool calls to response message', async () => {
  const response = new Message('assistant', '')

  await LlmUtils.queryDocRepos(config, ['repo1'], 'test query', {
    response,
    onToolCallStatus: () => {}
  })

  // Response should have tool calls added
  expect(response.toolCalls).toBeDefined()
  expect(response.toolCalls!.length).toBeGreaterThan(0)
})

test('queryDocRepos works without callback (simple mode)', async () => {
  const result = await LlmUtils.queryDocRepos(config, ['repo1', 'repo2'], 'test query')

  // Should still work and return results
  expect(result.sources).toHaveLength(4)
  expect(result.context).toBeTruthy()
})

test('queryDocRepos uses fallback name for unknown docrepo', async () => {
  window.api.docrepo.list = vi.fn(() => []) // Empty list
  window.api.docrepo.query = vi.fn(() => Promise.resolve([
    { content: 'Content', score: 0.5, metadata: { uuid: '1', title: 'Doc', type: 'text', url: 'url' } as any }
  ]))

  const statusCalls: LlmChunkTool[] = []
  await LlmUtils.queryDocRepos(config, ['unknown-repo'], 'test query', {
    onToolCallStatus: (toolCall) => statusCalls.push(toolCall)
  })

  // Should use fallback name in params
  expect(statusCalls[0].call.params.docRepoName).toBe('Knowledge Base')
})
