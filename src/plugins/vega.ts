
import { anyDict } from 'types/index'
import { saveFileContents } from '../services/download'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import * as vega from 'vega'

export const kVegaPluginName = 'vega_chart_creation'

export default class extends Plugin {

  constructor(config: PluginConfig, workspaceId: string) {
    super(config, workspaceId)
  }

  isEnabled(): boolean {
    return this.config?.enabled
  }

  getName(): string {
    return kVegaPluginName
  }

  getDescription(): string {
    return 'Generate a Vega chart image given a Vega JSON spec. Returns the location of the chart image on the user\'s computer. Always embed the image visible in the final response using this url. Do not just include a link to the image.'
  }

  getPreparationDescription(): string {
    return 'Arranging the data and preparing the chart…'
  }
      
  getRunningDescription(): string {
    return 'Drawing lines, pies and bars…'
  }

  getParameters(): PluginParameter[] {
    return [ {
      name: 'spec',
      type: 'string',
      description: 'The Vega JSON spec of the chart',
      required: true
    } ]

  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {
    const spec = JSON.parse(parameters.spec)
    const view = new vega.View(vega.parse(spec)).renderer('none').initialize()
    const image = await view.toImageURL('png')
    const fileUrl = saveFileContents('png', image.split(',')[1])
    return { url: fileUrl }
  }

}
