import { App } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Configuration } from 'types/config'
import { SkillFileManifestItem, SkillFileReadResult, SkillInstallResult, SkillLoadResult, SkillSaveResult, SkillSummary, SkillUninstallResult } from 'types/skills'
import extractZip from 'extract-zip'
import { loadSettings } from './config'

const kMaxSkillFileCount = 300
const kMaxFileReadChars = 40000
const kTextExtensions = new Set([
  '.txt', '.md', '.markdown', '.yaml', '.yml', '.json', '.jsonc', '.json5',
  '.toml', '.ini', '.cfg', '.conf', '.xml', '.csv', '.tsv', '.html', '.htm',
  '.css', '.scss', '.less', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.swift', '.kt', '.kts', '.php', '.sql',
  '.dockerfile', '.env'
])
const kBinaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.pdf', '.zip',
  '.gz', '.tar', '.7z', '.dmg', '.exe', '.dll', '.so', '.mp3', '.wav', '.mp4',
  '.mov', '.avi', '.woff', '.woff2', '.ttf', '.otf', '.bin'
])
const kSkippedDirectories = new Set(['.git', 'node_modules', '__pycache__'])
const kNoDescription = 'No description provided.'
const kGithubApiBase = 'https://api.github.com/repos'

const normalizePath = (filePath: string): string => {
  return path.resolve(filePath)
}

const expandHome = (app: App, filePath: string): string => {
  if (!filePath) return ''
  if (filePath === '~') return app.getPath('home')
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(app.getPath('home'), filePath.slice(2))
  }
  return filePath
}

const makeSkillId = (rootPath: string): string => {
  const hash = crypto.createHash('sha1').update(rootPath).digest('hex').slice(0, 12)
  return `skill_${hash}`
}

const isPathInside = (rootPath: string, filePath: string): boolean => {
  const relPath = path.relative(rootPath, filePath)
  return relPath !== '' && !relPath.startsWith('..') && !path.isAbsolute(relPath)
}

const systemSkillLocations = (app: App, workspaceId: string): string[] => {
  return [
    path.join(app.getPath('userData'), 'skills'),
    path.join(app.getPath('userData'), 'workspaces', workspaceId, 'skills'),
  ]
}

const isInSystemLocations = (app: App, workspaceId: string, filePath: string): boolean => {
  const absolutePath = normalizePath(filePath)
  return systemSkillLocations(app, workspaceId)
    .map(location => normalizePath(location))
    .some(root => isPathInside(root, absolutePath))
}

const parseSkillMdMetadata = (skillMd: string, fallbackName: string): { name: string, description: string } => {
  const name = fallbackName
  const description = kNoDescription

  const frontmatterMatch = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatterMatch) {
    return { name, description }
  }

  let parsedName: string | null = null
  let parsedDescription: string | null = null
  const lines = frontmatterMatch[1].split(/\r?\n/)
  for (const line of lines) {
    const separator = line.indexOf(':')
    if (separator <= 0) continue

    const key = line.slice(0, separator).trim().toLowerCase()
    let value = line.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1)
    }
    if (!value.length) continue

    if (key === 'name') {
      parsedName = value
    } else if (key === 'description') {
      parsedDescription = value
    }
  }

  return {
    name: parsedName || name,
    description: parsedDescription || description,
  }
}

const resolveSkillLocations = (app: App, workspaceId: string, config: Configuration): string[] => {
  const customLocations = Array.isArray(config.skills.locations)
    ? config.skills.locations
    : []

  const locations = [
    ...defaultSkillLocations(app, workspaceId),
    ...customLocations,
  ]
    .map(location => normalizePath(expandHome(app, location)))
    .filter(Boolean)

  return [...new Set(locations)]
}

const candidateRootsForLocation = (location: string): string[] => {
  const candidates = [
    location,
    path.join(location, '.claude', 'skills'),
    path.join(location, '.github', 'skills'),
  ]
  return [...new Set(candidates)]
}

const findSkillFolders = (skillsRoot: string): string[] => {
  const folders: string[] = []

  if (!fs.existsSync(skillsRoot)) {
    return folders
  }

  let stats: fs.Stats
  try {
    stats = fs.statSync(skillsRoot)
  } catch {
    return folders
  }

  if (!stats.isDirectory()) {
    return folders
  }

  if (fs.existsSync(path.join(skillsRoot, 'SKILL.md'))) {
    folders.push(skillsRoot)
  }

  try {
    const entries = fs.readdirSync(skillsRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const folder = path.join(skillsRoot, entry.name)
      if (fs.existsSync(path.join(folder, 'SKILL.md'))) {
        folders.push(folder)
      }
    }
  } catch {
    // ignore unreadable paths
  }

  return folders
}

const readSkillSummary = (skillRoot: string): SkillSummary | null => {
  const skillMdPath = path.join(skillRoot, 'SKILL.md')
  if (!fs.existsSync(skillMdPath)) {
    return null
  }

  let skillMd: string
  try {
    skillMd = fs.readFileSync(skillMdPath, 'utf-8')
  } catch {
    return null
  }

  const fallbackName = path.basename(skillRoot)
  const metadata = parseSkillMdMetadata(skillMd, fallbackName)
  return {
    id: makeSkillId(skillRoot),
    name: metadata.name,
    description: metadata.description,
    rootPath: skillRoot,
    skillMdPath,
  }
}

const isTextFile = (filePath: string, fileSize: number): boolean => {
  const ext = path.extname(filePath).toLowerCase()
  if (kTextExtensions.has(ext)) return true
  if (kBinaryExtensions.has(ext)) return false

  if (fileSize === 0) return true

  try {
    const fd = fs.openSync(filePath, 'r')
    const chunkSize = Math.min(fileSize, 1024)
    const buffer = Buffer.alloc(chunkSize)
    fs.readSync(fd, buffer, 0, chunkSize, 0)
    fs.closeSync(fd)
    return !buffer.includes(0)
  } catch {
    return false
  }
}

const collectSkillFiles = (skillRoot: string): SkillFileManifestItem[] => {
  const files: SkillFileManifestItem[] = []

  const walk = (folder: string): void => {
    if (files.length >= kMaxSkillFileCount) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (files.length >= kMaxSkillFileCount) return

      const absolutePath = path.join(folder, entry.name)
      if (entry.isDirectory()) {
        if (kSkippedDirectories.has(entry.name)) continue
        walk(absolutePath)
        continue
      }
      if (!entry.isFile()) continue

      try {
        const stat = fs.statSync(absolutePath)
        const relativePath = path.relative(skillRoot, absolutePath).split(path.sep).join('/')
        files.push({
          path: relativePath,
          size: stat.size,
          isText: isTextFile(absolutePath, stat.size),
        })
      } catch {
        // ignore unreadable files
      }
    }
  }

  walk(skillRoot)
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

const findSkillById = (app: App, workspaceId: string, skillId: string): SkillSummary | null => {
  const skills = listSkills(app, workspaceId)
  return skills.find(skill => skill.id === skillId) || null
}

export const defaultSkillLocations = (app: App, workspaceId: string): string[] => {
  void workspaceId
  const globalSkillsPath = path.join(app.getPath('userData'), 'skills')
  fs.mkdirSync(globalSkillsPath, { recursive: true })

  return [
    globalSkillsPath,
    // path.join(app.getPath('userData'), 'workspaces', workspaceId, 'skills'),
  ]
}

export const listSkills = (app: App, workspaceId: string): SkillSummary[] => {
  const config = loadSettings(app)
  const configuredLocations = resolveSkillLocations(app, workspaceId, config)
  const map = new Map<string, SkillSummary>()

  for (const location of configuredLocations) {
    const candidates = candidateRootsForLocation(location)
    for (const candidate of candidates) {
      for (const skillFolder of findSkillFolders(candidate)) {
        const skill = readSkillSummary(skillFolder)
        if (!skill) continue
        if (!map.has(skill.id)) {
          map.set(skill.id, skill)
        }
      }
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const loadSkill = (app: App, workspaceId: string, skillId: string): SkillLoadResult | null => {
  const skill = findSkillById(app, workspaceId, skillId)
  if (!skill) return null

  let skillMd = ''
  try {
    skillMd = fs.readFileSync(skill.skillMdPath, 'utf-8')
  } catch {
    return null
  }

  return {
    ...skill,
    instructions: skillMd,
    available_files: collectSkillFiles(skill.rootPath),
  }
}

export const getSkillFile = (
  app: App,
  workspaceId: string,
  skillId: string,
  relativePath: string,
  startLine?: number,
  endLine?: number,
): SkillFileReadResult => {
  const skill = findSkillById(app, workspaceId, skillId)
  if (!skill) {
    return { success: false, error: `Unknown skill: ${skillId}` }
  }

  if (!relativePath || !relativePath.trim()) {
    return { success: false, error: 'File path is required' }
  }

  const absolutePath = path.resolve(skill.rootPath, relativePath)
  if (!isPathInside(skill.rootPath, absolutePath)) {
    return { success: false, error: 'Path escapes skill directory' }
  }

  if (!fs.existsSync(absolutePath)) {
    return { success: false, error: `File not found: ${relativePath}` }
  }

  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch {
    return { success: false, error: `Cannot read file metadata: ${relativePath}` }
  }

  if (!stat.isFile()) {
    return { success: false, error: `Not a file: ${relativePath}` }
  }

  if (!isTextFile(absolutePath, stat.size)) {
    return { success: false, error: `File is binary and cannot be returned as text: ${relativePath}` }
  }

  let content: string
  try {
    content = fs.readFileSync(absolutePath, 'utf-8')
  } catch {
    return { success: false, error: `Cannot read file contents: ${relativePath}` }
  }

  const lines = content.split(/\r?\n/)
  const totalLines = lines.length

  let lineStart = startLine ? Math.max(1, Math.floor(startLine)) : 1
  let lineEnd = endLine ? Math.min(totalLines, Math.floor(endLine)) : totalLines

  if (lineEnd < lineStart) {
    return { success: false, error: 'endLine must be greater than or equal to startLine' }
  }

  if (lineStart > totalLines) {
    lineStart = totalLines
    lineEnd = totalLines
  }

  content = lines.slice(lineStart - 1, lineEnd).join('\n')
  let truncated = false
  if (content.length > kMaxFileReadChars) {
    content = content.slice(0, kMaxFileReadChars)
    truncated = true
  }

  return {
    success: true,
    content,
    truncated,
    totalLines,
    startLine: lineStart,
    endLine: lineEnd,
  }
}

export const uninstallSkill = (app: App, workspaceId: string, skillId: string): SkillUninstallResult => {
  const skill = findSkillById(app, workspaceId, skillId)
  if (!skill) {
    return { success: false, error: `Unknown skill: ${skillId}` }
  }

  void workspaceId
  const skillRoot = normalizePath(skill.rootPath)

  try {
    fs.rmSync(skillRoot, { recursive: true, force: true })
    return { success: true, removedPath: skillRoot }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const sanitizeFolderName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'skill'
}

const serializeSkillMd = (payload: { name: string, description?: string, instructions: string }): string => {
  const safeName = payload.name.trim().replace(/\r?\n/g, ' ')
  const safeDescription = (payload.description || '').trim().replace(/\r?\n/g, ' ')
  const body = payload.instructions.trim()
  return [
    '---',
    `name: ${safeName}`,
    `description: ${safeDescription || kNoDescription}`,
    '---',
    '',
    body,
    '',
  ].join('\n')
}

const uniqueFolderPath = (baseFolder: string): string => {
  if (!fs.existsSync(baseFolder)) return baseFolder

  let index = 2
  while (true) {
    const candidate = `${baseFolder}-${index}`
    if (!fs.existsSync(candidate)) return candidate
    index++
  }
}

const copyDirectoryRecursive = (sourceDir: string, targetDir: string): void => {
  fs.mkdirSync(targetDir, { recursive: true })
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath)
      continue
    }
    if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

const parseGithubRepoUrl = (rawUrl: string): { owner: string, repo: string, branch?: string, repoSubPath?: string, repoUrl: string } | null => {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return null
  }

  if (parsed.hostname !== 'github.com') return null
  const parts = parsed.pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null

  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (!owner || !repo) return null

  let branch: string | undefined
  let repoSubPath: string | undefined
  if (parts[2] === 'tree' && parts.length >= 5) {
    branch = parts[3]
    repoSubPath = parts.slice(4).join('/')
  }

  return {
    owner,
    repo,
    branch,
    repoSubPath,
    repoUrl: `https://github.com/${owner}/${repo}`,
  }
}

const tokenizeInstallInput = (input: string): string[] => {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g) || []
  return matches.map(token => token.replace(/^['"]|['"]$/g, ''))
}

export const extractRepoAndSkillFromInstallInput = (input: string): {
  repoUrl: string
  skillName?: string
  branch?: string
  repoSubPath?: string
} | null => {
  const trimmed = input.trim()
  if (!trimmed.length) return null

  if (/^https?:\/\/github\.com\//i.test(trimmed)) {
    const github = parseGithubRepoUrl(trimmed)
    if (!github) return null
    return {
      repoUrl: github.repoUrl,
      branch: github.branch,
      repoSubPath: github.repoSubPath,
    }
  }

  const tokens = tokenizeInstallInput(trimmed)
  if (!tokens.length) return null

  const repoUrl = tokens.find(token => /^https?:\/\/github\.com\//i.test(token))
  if (!repoUrl) return null

  let skillName: string | undefined
  const skillArgIndex = tokens.findIndex(token => token === '--skill' || token === '-s')
  if (skillArgIndex >= 0 && tokens[skillArgIndex + 1]) {
    skillName = tokens[skillArgIndex + 1]
  } else {
    const equalsArg = tokens.find(token => token.startsWith('--skill='))
    if (equalsArg) {
      skillName = equalsArg.slice('--skill='.length)
    }
  }

  const github = parseGithubRepoUrl(repoUrl)
  if (!github) return null

  return {
    repoUrl: github.repoUrl,
    skillName: skillName?.trim() || undefined,
    branch: github.branch,
    repoSubPath: github.repoSubPath,
  }
}

const normalizeSkillSelector = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
}

const githubDefaultBranch = async (owner: string, repo: string): Promise<string> => {
  const response = await fetch(`${kGithubApiBase}/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github+json' },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status})`)
  }

  const data = await response.json() as { default_branch?: string }
  if (!data.default_branch || typeof data.default_branch !== 'string') {
    throw new Error('Unable to resolve default branch')
  }
  return data.default_branch
}

const downloadToFile = async (url: string, outFile: string): Promise<void> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  const data = await response.arrayBuffer()
  fs.writeFileSync(outFile, Buffer.from(data))
}

const isPathInsideOrEqual = (rootPath: string, filePath: string): boolean => {
  const relPath = path.relative(rootPath, filePath)
  return relPath === '' || (!relPath.startsWith('..') && !path.isAbsolute(relPath))
}

const discoverSkillFoldersFromExtractedRepo = (extractRoot: string, repoSubPath?: string): string[] => {
  let repoRoot = extractRoot
  const topLevelEntries = fs.readdirSync(extractRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
  if (topLevelEntries.length === 1) {
    repoRoot = path.join(extractRoot, topLevelEntries[0].name)
  }

  let scanRoot = repoRoot
  if (repoSubPath?.length) {
    const requestedRoot = path.resolve(repoRoot, repoSubPath)
    if (!isPathInsideOrEqual(repoRoot, requestedRoot) || !fs.existsSync(requestedRoot)) {
      return []
    }
    scanRoot = requestedRoot
  }

  const found = new Set<string>()

  const walk = (folder: string): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const entryPath = path.join(folder, entry.name)
      if (entry.isDirectory()) {
        if (kSkippedDirectories.has(entry.name)) continue
        walk(entryPath)
        continue
      }
      if (!entry.isFile()) continue
      if (entry.name !== 'SKILL.md') continue

      found.add(path.dirname(entryPath))
    }
  }

  walk(scanRoot)
  return [...found]
}

export const installSkillFromUrl = async (app: App, url: string, installPath: string): Promise<SkillInstallResult> => {
  const parsedInput = extractRepoAndSkillFromInstallInput(url)
  if (!parsedInput) {
    return {
      success: false,
      installed: [],
      error: 'Provide a GitHub URL or a skills install command (for example: npx skills add <url> --skill <name>)',
    }
  }
  const parsed = parseGithubRepoUrl(parsedInput.repoUrl)
  if (!parsed) {
    return {
      success: false,
      installed: [],
      error: 'Only GitHub repository URLs are supported for now',
    }
  }

  const targetRoot = normalizePath(expandHome(app, installPath || ''))
  if (!targetRoot) {
    return {
      success: false,
      installed: [],
      error: 'Install path is required',
    }
  }

  fs.mkdirSync(targetRoot, { recursive: true })

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-skill-install-'))
  const zipPath = path.join(tempRoot, 'repo.zip')
  const extractPath = path.join(tempRoot, 'repo')

  try {
    const branch = parsedInput.branch || await githubDefaultBranch(parsed.owner, parsed.repo)
    const archiveUrl = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/refs/heads/${encodeURIComponent(branch)}`

    await downloadToFile(archiveUrl, zipPath)
    fs.mkdirSync(extractPath, { recursive: true })
    await extractZip(zipPath, { dir: extractPath })

    let skillFolders = discoverSkillFoldersFromExtractedRepo(extractPath, parsedInput.repoSubPath)
    if (parsedInput.skillName) {
      const selector = normalizeSkillSelector(parsedInput.skillName)
      const matching = skillFolders.filter((skillFolder) => {
        const summary = readSkillSummary(skillFolder)
        const aliases = [
          path.basename(skillFolder),
          summary?.name || '',
          summary?.description || '',
        ]
        return aliases.some(alias => alias && normalizeSkillSelector(alias) === selector)
      })
      if (!matching.length) {
        return {
          success: false,
          installed: [],
          location: targetRoot,
          error: `Requested skill not found: ${parsedInput.skillName}`,
        }
      }
      skillFolders = matching
    }

    if (!skillFolders.length) {
      return {
        success: false,
        installed: [],
        location: targetRoot,
        error: 'No SKILL.md files were found in this repository',
      }
    }

    const installed: string[] = []
    for (const skillFolder of skillFolders) {
      const summary = readSkillSummary(skillFolder)
      const preferredName = summary?.name || path.basename(skillFolder)
      const folderName = sanitizeFolderName(preferredName)
      const destination = uniqueFolderPath(path.join(targetRoot, folderName))
      copyDirectoryRecursive(skillFolder, destination)
      installed.push(path.basename(destination))
    }

    return {
      success: installed.length > 0,
      installed,
      location: targetRoot,
      error: installed.length ? undefined : 'No skills were installed',
    }
  } catch (error) {
    return {
      success: false,
      installed: [],
      location: targetRoot,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    } catch {
      // no-op
    }
  }
}

export const createSkill = (
  app: App,
  workspaceId: string,
  payload: { name: string, description?: string, instructions: string },
): SkillSaveResult => {
  if (!payload.name?.trim() || !payload.instructions?.trim()) {
    return { success: false, error: 'name and instructions are required' }
  }

  const root = normalizePath(systemSkillLocations(app, workspaceId)[0])
  fs.mkdirSync(root, { recursive: true })

  const folderName = sanitizeFolderName(payload.name)
  const skillRoot = uniqueFolderPath(path.join(root, folderName))
  try {
    fs.mkdirSync(skillRoot, { recursive: true })
    fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), serializeSkillMd({
      ...payload,
      // Keep SKILL.md metadata name aligned with the actual folder name.
      name: path.basename(skillRoot),
    }), 'utf-8')
    return {
      success: true,
      skillId: makeSkillId(skillRoot),
      rootPath: skillRoot,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export const updateSkill = (
  app: App,
  workspaceId: string,
  skillId: string,
  payload: { name: string, description?: string, instructions: string },
): SkillSaveResult => {
  if (!payload.name?.trim() || !payload.instructions?.trim()) {
    return { success: false, error: 'name and instructions are required' }
  }

  const skill = findSkillById(app, workspaceId, skillId)
  if (!skill) {
    return { success: false, error: `Unknown skill: ${skillId}` }
  }
  if (!isInSystemLocations(app, workspaceId, skill.rootPath)) {
    return { success: false, error: 'Only skills in Witsy locations can be edited' }
  }

  try {
    fs.writeFileSync(path.join(skill.rootPath, 'SKILL.md'), serializeSkillMd({
      ...payload,
      // Keep SKILL.md metadata name aligned with the actual folder name.
      name: path.basename(skill.rootPath),
    }), 'utf-8')
    return {
      success: true,
      skillId: skill.id,
      rootPath: skill.rootPath,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
