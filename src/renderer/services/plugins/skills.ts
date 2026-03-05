import { MultiToolPlugin, PluginExecutionContext, PluginTool } from 'multi-llm-ts'
import { anyDict } from 'types/index'
import { t } from '../i18n'
import { PluginConfig } from './plugin'

export const kSkillsPluginName = 'skills'
export const kSkillsPluginPrefix = 'skills_'
export const kSkillsLoadToolName = `${kSkillsPluginPrefix}load_skill`
export const kSkillsGetFileToolName = `${kSkillsPluginPrefix}get_skill_file`

export interface SkillsPluginConfig extends PluginConfig {
  enabled: boolean
  locations: string[]
}

export default class extends MultiToolPlugin {

  config: SkillsPluginConfig
  workspaceId: string

  constructor(config: SkillsPluginConfig, workspaceId: string) {
    super()
    this.config = config
    this.workspaceId = workspaceId
  }

  isEnabled(): boolean {
    return this.config?.enabled || false
  }

  getName(): string {
    return 'Skills'
  }

  getToolNamePrefix(): string {
    return kSkillsPluginPrefix
  }

  getDescription(): string {
    return t('plugins.skills.description')
  }

  getPreparationDescription(tool: string): string {
    if (tool === kSkillsGetFileToolName) {
      return t('plugins.skills.preparingFile')
    }
    return t('plugins.skills.preparing')
  }

  getRunningDescription(tool: string): string {
    if (tool === kSkillsGetFileToolName) {
      return t('plugins.skills.runningFile')
    }
    return t('plugins.skills.running')
  }

  getCompletedDescription(tool: string, _args: any, results: any): string | undefined {
    if (results?.error) {
      return t('plugins.skills.error', { error: results.error })
    }
    if (tool === kSkillsGetFileToolName) {
      return t('plugins.skills.completedFile')
    }
    return t('plugins.skills.completed')
  }

  async getTools(): Promise<PluginTool[]> {
    const tools: PluginTool[] = [
      {
        name: kSkillsLoadToolName,
        description: 'Call this first when a skill looks relevant. Loads one skill by id and returns SKILL.md plus a manifest of available skill files.',
        parameters: [
          { name: 'skillId', type: 'string', description: 'The id of the skill to load', required: true },
        ]
      },
      {
        name: kSkillsGetFileToolName,
        description: 'After loading a skill, use this to read additional files referenced by SKILL.md or needed for full execution.',
        parameters: [
          { name: 'skillId', type: 'string', description: 'The id of the skill', required: true },
          { name: 'path', type: 'string', description: 'Relative path of the file inside the skill folder', required: true },
          { name: 'startLine', type: 'number', description: 'Optional 1-indexed first line to return', required: false },
          { name: 'endLine', type: 'number', description: 'Optional 1-indexed last line to return', required: false },
        ]
      },
    ]

    if (this.toolsEnabled) {
      return tools.filter(tool => this.toolsEnabled.includes(tool.name))
    }
    return tools
  }

  handlesTool(name: string): boolean {
    const handled = [kSkillsLoadToolName, kSkillsGetFileToolName].includes(name)
    return handled && (!this.toolsEnabled || this.toolsEnabled.includes(name))
  }

  async execute(_context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

    if (!this.handlesTool(parameters.tool)) {
      return { error: `Tool ${parameters.tool} is not handled by this plugin` }
    }

    const { tool, parameters: args } = parameters
    if (tool === kSkillsLoadToolName) {
      if (!args?.skillId) {
        return { error: 'Parameter skillId is required' }
      }

      const skill = window.api.skills.load(this.workspaceId, args.skillId)
      if (!skill) {
        return { error: `Skill not found: ${args.skillId}` }
      }
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        available_files: skill.available_files,
      }
    }

    if (!args?.skillId) {
      return { error: 'Parameter skillId is required' }
    }
    if (!args?.path) {
      return { error: 'Parameter path is required' }
    }

    const file = window.api.skills.getFile(
      this.workspaceId,
      args.skillId,
      args.path,
      args.startLine,
      args.endLine,
    )
    return {
      success: file.success,
      content: file.content,
      error: file.error,
      truncated: file.truncated,
      startLine: file.startLine,
      endLine: file.endLine,
      totalLines: file.totalLines,
    }
  }
}
