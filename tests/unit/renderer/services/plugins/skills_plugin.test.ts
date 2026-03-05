import { beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import SkillsPlugin, {
  kSkillsGetFileToolName,
  kSkillsLoadToolName,
  kSkillsPluginPrefix
} from '@services/plugins/skills'

const workspaceId = 'workspace1'

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('skills plugin metadata', () => {
  const plugin = new SkillsPlugin({ enabled: true, locations: [] }, workspaceId)
  expect(plugin.isEnabled()).toBe(true)
  expect(plugin.getName()).toBe('Skills')
  expect(plugin.getToolNamePrefix()).toBe(kSkillsPluginPrefix)
  expect(plugin.getDescription()).toBe('plugins.skills.description')
})

test('skills plugin getTools', async () => {
  const plugin = new SkillsPlugin({ enabled: true, locations: [] }, workspaceId)
  const tools = await plugin.getTools()
  expect(tools).toHaveLength(2)
  expect(tools[0].name).toBe(kSkillsLoadToolName)
  expect(tools[1].name).toBe(kSkillsGetFileToolName)
})

test('skills plugin handlesTool', () => {
  const plugin = new SkillsPlugin({ enabled: true, locations: [] }, workspaceId)
  expect(plugin.handlesTool(kSkillsLoadToolName)).toBe(true)
  expect(plugin.handlesTool(kSkillsGetFileToolName)).toBe(true)
  expect(plugin.handlesTool('unknown_tool')).toBe(false)
})

test('skills plugin execute load tool', async () => {
  window.api.skills.load = vi.fn(() => ({
    id: 'skill_123',
    name: 'My skill',
    description: 'desc',
    rootPath: '/tmp/skill',
    skillMdPath: '/tmp/skill/SKILL.md',
    instructions: '# Instructions',
    available_files: []
  }))

  const plugin = new SkillsPlugin({ enabled: true, locations: [] }, workspaceId)
  const result = await plugin.execute({} as any, {
    tool: kSkillsLoadToolName,
    parameters: { skillId: 'skill_123' }
  })

  expect(window.api.skills.load).toHaveBeenCalledWith(workspaceId, 'skill_123')
  expect(result.name).toBe('My skill')
  expect(result.rootPath).toBeUndefined()
  expect(result.skillMdPath).toBeUndefined()
  expect(result.instructions).toBe('# Instructions')
})

test('skills plugin execute get file tool', async () => {
  window.api.skills.getFile = vi.fn(() => ({
    success: true,
    content: 'line1\nline2',
    rootPath: '/tmp/skill',
    totalLines: 2,
    startLine: 1,
    endLine: 2,
  }))

  const plugin = new SkillsPlugin({ enabled: true, locations: [] }, workspaceId)
  const result = await plugin.execute({} as any, {
    tool: kSkillsGetFileToolName,
    parameters: { skillId: 'skill_123', path: 'scripts/helper.py', startLine: 1, endLine: 2 }
  })

  expect(window.api.skills.getFile).toHaveBeenCalledWith(
    workspaceId,
    'skill_123',
    'scripts/helper.py',
    1,
    2
  )
  expect(result.success).toBe(true)
  expect(result.rootPath).toBeUndefined()
})
