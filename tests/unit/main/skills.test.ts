import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { loadSettings } from '@main/config'
import extractZip from 'extract-zip'
import { createSkill, defaultSkillLocations, extractRepoAndSkillFromInstallInput, getSkillFile, installSkillFromUrl, listSkills, loadSkill, uninstallSkill, updateSkill } from '@main/skills'

vi.mock('@main/config', () => ({
  loadSettings: vi.fn(),
}))

vi.mock('extract-zip', () => ({
  default: vi.fn(),
}))

let tmpDir = ''
let homeDir = ''
let userDataDir = ''
let customLocation = ''
const workspaceId = 'workspace-1'

const createTestApp = () => ({
  getPath: (name: string) => {
    if (name === 'home') return homeDir
    if (name === 'userData') return userDataDir
    return tmpDir
  }
}) as any

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-skills-'))
  homeDir = path.join(tmpDir, 'home')
  userDataDir = path.join(tmpDir, 'userdata')
  customLocation = path.join(tmpDir, 'custom-skills')

  fs.mkdirSync(homeDir, { recursive: true })
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.mkdirSync(customLocation, { recursive: true })

  const skillRoot = path.join(customLocation, 'test-skill')
  fs.mkdirSync(path.join(skillRoot, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), `---
name: testing-skill
description: Skill for unit tests
---

# Test Skill
`)
  fs.writeFileSync(path.join(skillRoot, 'scripts', 'helper.py'), 'print("hello")\nprint("world")\n')
  fs.writeFileSync(path.join(skillRoot, 'notes.txt'), 'alpha\nbeta\ngamma\n')

  vi.mocked(loadSettings).mockReturnValue({
    skills: {
      locations: [customLocation]
    }
  } as any)
})

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

test('defaultSkillLocations returns expected paths', () => {
  const app = createTestApp()
  const locations = defaultSkillLocations(app, workspaceId)
  expect(locations).toEqual([
    path.join(userDataDir, 'skills'),
  ])
  expect(fs.existsSync(path.join(userDataDir, 'skills'))).toBe(true)
})

test('listSkills discovers skills from configured locations', () => {
  const app = createTestApp()
  const skills = listSkills(app, workspaceId)
  expect(skills).toHaveLength(1)
  expect(skills[0].name).toBe('testing-skill')
  expect(skills[0].description).toBe('Skill for unit tests')
  expect(skills[0].id).toMatch(/^skill_[a-f0-9]{12}$/)
})

test('loadSkill returns SKILL.md and manifest', () => {
  const app = createTestApp()
  const skill = listSkills(app, workspaceId)[0]
  const loaded = loadSkill(app, workspaceId, skill.id)
  expect(loaded).not.toBeNull()
  expect(loaded?.instructions).toContain('name: testing-skill')
  expect(loaded?.available_files.some(file => file.path === 'scripts/helper.py')).toBe(true)
})

test('getSkillFile reads line ranges', () => {
  const app = createTestApp()
  const skill = listSkills(app, workspaceId)[0]
  const result = getSkillFile(app, workspaceId, skill.id, 'notes.txt', 2, 3)
  expect(result.success).toBe(true)
  expect(result.content).toBe('beta\ngamma')
  expect(result.startLine).toBe(2)
  expect(result.endLine).toBe(3)
})

test('getSkillFile blocks path traversal', () => {
  const app = createTestApp()
  const skill = listSkills(app, workspaceId)[0]
  const result = getSkillFile(app, workspaceId, skill.id, '../outside.txt')
  expect(result.success).toBe(false)
  expect(result.error).toContain('escapes skill directory')
})

test('installSkillFromUrl installs all discovered skills (root and subfolders)', async () => {
  const app = createTestApp()
  const installPath = path.join(tmpDir, 'installed-skills')

  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === 'https://api.github.com/repos/nicobailon/visual-explainer') {
      return {
        ok: true,
        json: async () => ({ default_branch: 'main' }),
      } as any
    }
    return {
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as any
  }))

  vi.mocked(extractZip).mockImplementation(async (_zipFile: string, opts: { dir: string }) => {
    const root = path.join(opts.dir, 'visual-explainer-main')
    const nestedSkillRoot = path.join(root, '.claude', 'skills', 'visual-explainer')
    fs.mkdirSync(nestedSkillRoot, { recursive: true })
    fs.writeFileSync(path.join(root, 'SKILL.md'), `---
name: Root Skill
description: Root level skill
---
`)
    fs.writeFileSync(path.join(nestedSkillRoot, 'SKILL.md'), `---
name: Visual Explainer
description: Explain visuals
---
`)
    fs.writeFileSync(path.join(nestedSkillRoot, 'README.md'), '# hello')
  })

  const result = await installSkillFromUrl(app, 'https://github.com/nicobailon/visual-explainer', installPath)
  expect(result.success).toBe(true)
  expect(result.location).toBe(installPath)
  expect(result.installed).toHaveLength(2)
  expect(result.installed).toContain('root-skill')
  expect(result.installed).toContain('visual-explainer')
  expect(fs.existsSync(path.join(installPath, 'root-skill', 'SKILL.md'))).toBe(true)
  expect(fs.existsSync(path.join(installPath, 'visual-explainer', 'SKILL.md'))).toBe(true)
})

test('installSkillFromUrl rejects unsupported URLs', async () => {
  const app = createTestApp()
  const result = await installSkillFromUrl(app, 'https://example.com/skills/repo', path.join(tmpDir, 'installed'))
  expect(result.success).toBe(false)
  expect(result.error).toContain('Provide a GitHub URL or a skills install command')
})

test('extractRepoAndSkillFromInstallInput parses skills command', () => {
  const parsed = extractRepoAndSkillFromInstallInput('npx skills add https://github.com/anthropics/skills --skill frontend-design')
  expect(parsed).toEqual({
    repoUrl: 'https://github.com/anthropics/skills',
    skillName: 'frontend-design',
  })
})

test('extractRepoAndSkillFromInstallInput parses github tree url', () => {
  const parsed = extractRepoAndSkillFromInstallInput('https://github.com/anthropics/skills/tree/main/skills/brand-guidelines')
  expect(parsed).toEqual({
    repoUrl: 'https://github.com/anthropics/skills',
    branch: 'main',
    repoSubPath: 'skills/brand-guidelines',
  })
})

test('installSkillFromUrl installs only skills under github tree subpath', async () => {
  const app = createTestApp()
  const installPath = path.join(tmpDir, 'installed-tree-skills')

  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === 'https://api.github.com/repos/anthropics/skills') {
      return {
        ok: true,
        json: async () => ({ default_branch: 'main' }),
      } as any
    }
    return {
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as any
  }))

  vi.mocked(extractZip).mockImplementation(async (_zipFile: string, opts: { dir: string }) => {
    const root = path.join(opts.dir, 'skills-main')
    const selected = path.join(root, 'skills', 'brand-guidelines')
    const ignored = path.join(root, 'skills', 'other-skill')
    fs.mkdirSync(selected, { recursive: true })
    fs.mkdirSync(ignored, { recursive: true })
    fs.writeFileSync(path.join(selected, 'SKILL.md'), `---\nname: Brand Guidelines\n---\n`)
    fs.writeFileSync(path.join(ignored, 'SKILL.md'), `---\nname: Other Skill\n---\n`)
  })

  const result = await installSkillFromUrl(app, 'https://github.com/anthropics/skills/tree/main/skills/brand-guidelines', installPath)
  expect(result.success).toBe(true)
  expect(result.installed).toEqual(['brand-guidelines'])
  expect(fs.existsSync(path.join(installPath, 'brand-guidelines', 'SKILL.md'))).toBe(true)
  expect(fs.existsSync(path.join(installPath, 'other-skill', 'SKILL.md'))).toBe(false)
})

test('uninstallSkill removes skills installed in global folder', () => {
  const app = createTestApp()
  const globalSkills = path.join(userDataDir, 'skills')
  const localSkill = path.join(globalSkills, 'local-skill')
  fs.mkdirSync(localSkill, { recursive: true })
  fs.writeFileSync(path.join(localSkill, 'SKILL.md'), '# local skill')

  const skill = listSkills(app, workspaceId).find(item => item.rootPath === localSkill)
  expect(skill).toBeTruthy()

  const result = uninstallSkill(app, workspaceId, skill!.id)
  expect(result.success).toBe(true)
  expect(fs.existsSync(localSkill)).toBe(false)
})

test('uninstallSkill removes skills outside system folder', () => {
  const app = createTestApp()
  const skill = listSkills(app, workspaceId)[0]
  const result = uninstallSkill(app, workspaceId, skill.id)
  expect(result.success).toBe(true)
  expect(fs.existsSync(skill.rootPath)).toBe(false)
})

test('createSkill writes SKILL.md in witsy system location', () => {
  const app = createTestApp()
  const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined as any)
  const result = createSkill(app, workspaceId, {
    name: 'My Skill',
    description: 'Description',
    instructions: 'Do this first.',
  })
  expect(result.success).toBe(true)
  expect(result.rootPath).toContain(path.join('userdata', 'skills'))
  expect(writeSpy).toHaveBeenCalledOnce()
  expect(writeSpy).toHaveBeenCalledWith(path.join(result.rootPath!, 'SKILL.md'), expect.any(String), 'utf-8')
  const skillMd = writeSpy.mock.calls[0][1] as string
  expect(skillMd).toContain('name: my-skill')
  expect(skillMd).toContain('description: Description')
  expect(skillMd).toContain('Do this first.')
  writeSpy.mockRestore()
})

test('createSkill aligns SKILL.md name with folder name', () => {
  const app = createTestApp()
  const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined as any)
  const result = createSkill(app, workspaceId, {
    name: 'Test',
    description: 'Description',
    instructions: 'Do this first.',
  })
  expect(result.success).toBe(true)
  expect(path.basename(result.rootPath!)).toBe('test')
  const skillMd = writeSpy.mock.calls[0][1] as string
  expect(skillMd).toContain('name: test')
  writeSpy.mockRestore()
})

test('updateSkill only allows editing witsy location skills', () => {
  const app = createTestApp()
  const globalSkills = path.join(userDataDir, 'skills')
  const editableSkill = path.join(globalSkills, 'editable-skill')
  fs.mkdirSync(editableSkill, { recursive: true })
  fs.writeFileSync(path.join(editableSkill, 'SKILL.md'), `---\nname: editable-skill\ndescription: Initial\n---\n\nv1\n`)
  const created = listSkills(app, workspaceId).find(skill => skill.rootPath === editableSkill)
  expect(created).toBeTruthy()

  const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined as any)
  const updated = updateSkill(app, workspaceId, created!.id, {
    name: 'Editable Skill',
    description: 'Updated',
    instructions: 'v2',
  })
  expect(updated.success).toBe(true)
  expect(writeSpy).toHaveBeenCalledWith(path.join(editableSkill, 'SKILL.md'), expect.any(String), 'utf-8')
  const skillMd = writeSpy.mock.calls[0][1] as string
  expect(skillMd).toContain('name: editable-skill')
  expect(skillMd).toContain('v2')

  const externalSkill = listSkills(app, workspaceId).find(skill => skill.rootPath.startsWith(customLocation))
  expect(externalSkill).toBeTruthy()
  const rejected = updateSkill(app, workspaceId, externalSkill!.id, {
    name: 'Nope',
    description: 'Nope',
    instructions: 'Nope',
  })
  expect(rejected.success).toBe(false)
  expect(rejected.error).toContain('Only skills in Witsy locations can be edited')
  writeSpy.mockRestore()
})
