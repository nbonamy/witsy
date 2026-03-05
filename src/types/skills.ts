export type SkillHeader = {
  id: string
  name: string
  description: string
  rootPath: string
  skillMdPath: string
}

export type SkillFileManifestItem = {
  path: string
  size: number
  isText: boolean
}

export type Skill = SkillHeader & {
  instructions: string
  available_files: SkillFileManifestItem[]
}

export type SkillFileReadResult = {
  success: boolean
  content?: string
  error?: string
  truncated?: boolean
  startLine?: number
  endLine?: number
  totalLines?: number
}

export type SkillInstallResult = {
  success: boolean
  error?: string
  installed: string[]
  location?: string
}

export type SkillUninstallResult = {
  success: boolean
  error?: string
  removedPath?: string
}

export type SkillSaveResult = {
  success: boolean
  error?: string
  skillId?: string
  rootPath?: string
}
