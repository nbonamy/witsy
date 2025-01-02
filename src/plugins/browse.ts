
import { anyDict } from 'types/index'
import { PluginParameter } from 'multi-llm-ts'
import { convert } from 'html-to-text'
import Plugin, { PluginConfig } from './plugin'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config?.enabled
  }

  getName(): string {
    return 'extract_webpage_content'
  }

  getDescription(): string {
    return 'Returns the text content a web page given a URL. Use this tool to get detailed information or summarize the content of a web page.'
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }
      
  getRunningDescription(): string {
    return 'Downloading content…'
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'url',
        type: 'string',
        description: 'The URL of the page to download',
        required: true
      }
    ]
  }

  async execute(parameters: anyDict): Promise<anyDict> {

    try {
      const html = await fetch(parameters.url).then(response => response.text())
      const text = convert(html, {
        selectors: [
          { selector: 'img', format: 'skip' }
        ]
      })
      return { content: text }

    } catch (error) {
      return error
    }

  }  

}
