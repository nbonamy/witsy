
import { anyDict } from 'types/index'
import { Plugin as PluginBase } from 'multi-llm-ts'

export type PluginConfig = anyDict

export default class Plugin extends PluginBase {

  config: PluginConfig

  constructor(config: PluginConfig) {
    super()
    this.config = config
  }

}
