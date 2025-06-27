
import { anyDict } from '../types/index'
import { PluginExecutionContext, PluginParameter, mimeTypeToExtension } from 'multi-llm-ts'
import { convert } from 'html-to-text'
import Plugin, { PluginConfig } from './plugin'
import { t } from '../services/i18n'

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
    return t('plugins.browse.running')
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    if (results.error) {
      return t('plugins.browse.error')
    } else {
      return t('plugins.browse.completed', { title: results.title })
    }
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

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

    try {

      // get the html
      const response = await fetch(parameters.url)
      if (!response.ok) {
        return { error: `Failed to fetch URL: ${response.status} ${response.statusText}` }
      }

      // check mime type
      const contentType = response.headers?.get('content-type') || 'text/plain'
      if (contentType.includes('pdf') || contentType.includes('officedocument')) {
        return this.processDocument(response)
      }

      // should be readable text
      const source = await response.text()

      // html needs some work
      if (contentType.includes('text/html')) {

        // extract title from html code using a regex
        const titleMatch = source.match(/<title>(.*?)<\/title>/i)
        const title = titleMatch ? titleMatch[1] : parameters.url

        // convert the html to text
        const text = convert(source, {
          selectors: [
            { selector: 'img', format: 'skip' }
          ]
        })

        // done
        return {
          title: title,
          content: text
        }
      }

      // assume it's plain text
      return {
        content: source,
      }


    } catch (error) {
      return { error: error }
    }

  }
  async processDocument(response: Response): Promise<anyDict> {
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const b64 = btoa(String.fromCharCode(...uint8Array))
    const contentType = response.headers.get('content-type')
    const format = mimeTypeToExtension(contentType)
    return {
      title: response.url,
      content: window.api.file.extractText(b64, format),
    }
  }

}
