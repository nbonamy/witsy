
import { anyDict } from '../types/index.d'
import { Configuration } from '../types/config.d'
import { PluginParameter } from '../types/plugin.d';
import Plugin from './plugin'
import { convert } from 'html-to-text'

export default class extends Plugin {

  constructor(config: Configuration) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  getName(): string {
    return 'get_html_as_text'
  }

  getDescription(): string {
    return 'Download an HTML page and return the text content'
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
