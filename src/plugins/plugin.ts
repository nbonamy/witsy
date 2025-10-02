
import { anyDict } from 'types/index'
import { Plugin as PluginBase } from 'multi-llm-ts'

export type PluginConfig = anyDict

export default class Plugin extends PluginBase {

  config: PluginConfig
  workspaceId: string

  constructor(config: PluginConfig, workspaceId: string) {
    super()
    this.config = config
    this.workspaceId = workspaceId
  }

}
