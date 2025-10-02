
import { anyDict } from '../types/index'
import { PluginExecutionContext, PluginParameter, mimeTypeToExtension } from 'multi-llm-ts'
import { convert } from 'html-to-text'
import Plugin, { PluginConfig } from './plugin'
import { t } from '../services/i18n'

export default class extends Plugin {

  constructor(config: PluginConfig, workspaceId: string) {
    super(config, workspaceId)
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
    const blob = await response.blob()
    const b64 = await this.blobToBase64(blob)
    const content = b64.split(',')[1]
    const contentType = response.headers.get('content-type')
    const format = mimeTypeToExtension(contentType)
    const text = window.api.file.extractText(content, format)
    return {
      title: response.url,
      content: text,
    }
  }

  async blobToBase64(blob: Blob): Promise<string>{
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
  }
}
