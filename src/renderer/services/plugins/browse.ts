
import { convert } from 'html-to-text'
import { PluginExecutionContext, PluginParameter, mimeTypeToExtension } from 'multi-llm-ts'
import { anyDict } from 'types/index'
import { t } from '../i18n'
import Plugin, { PluginConfig } from './plugin'

export const kBrowsePluginName = 'extract_webpage_content'

export default class extends Plugin {

  private kDefaultChunkLength = 50
  private kDefaultMaxChunks = 5

  constructor(config: PluginConfig, workspaceId: string) {
    super(config, workspaceId)
  }

  isEnabled(): boolean {
    return this.config?.enabled
  }

  getName(): string {
    return kBrowsePluginName
  }

  getDescription(): string {
    return 'Returns the text content a web page given a URL. Use this tool to get detailed information or summarize the content of a web page. Optionally search for specific text and return relevant chunks with context.'
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
      },
      {
        name: 'search',
        type: 'string',
        description: 'Optional text to search for. Returns chunks of text containing this search term with surrounding context.',
        required: false
      },
      {
        name: 'maxChunks',
        type: 'number',
        description: `Maximum number of text chunks to return (default: ${this.kDefaultMaxChunks})`,
        required: false
      },
      {
        name: 'chunkLength',
        type: 'number',
        description: `Length of text chunks to return around search matches (default: ${this.kDefaultChunkLength} characters after match, half before)`,
        required: false
      }
    ]
  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

    // set chunking parameters if provided
    if (!parameters.maxChunks) {
      parameters.maxChunks = this.kDefaultMaxChunks
    }
    if (!parameters.chunkLength) {
      parameters.chunkLength = this.kDefaultChunkLength
    }

    try {

      // get the html
      const response = await fetch(parameters.url)
      if (!response.ok) {
        return { error: `Failed to fetch URL: ${response.status} ${response.statusText}` }
      }

      // check mime type
      const contentType = response.headers?.get('content-type') || 'text/plain'
      if (contentType.includes('pdf') || contentType.includes('officedocument')) {
        return this.processDocument(response, parameters)
      }

      // should be readable text
      const source = await response.text()

      // html needs some work
      if (contentType.includes('text/html')) {
        return this.processHtml(source, parameters)
      }

      // assume it's plain text
      return {
        content: this.extractSearchChunks(source, parameters),
      }


    } catch (error) {
      return { error: error }
    }

  }

  private processHtml(source: string, parameters: anyDict): anyDict {
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
      content: this.extractSearchChunks(text, parameters),
    }
  }

  async processDocument(response: Response, parameters: anyDict): Promise<anyDict> {
    const blob = await response.blob()
    const b64 = await this.blobToBase64(blob)
    const content = b64.split(',')[1]
    const contentType = response.headers.get('content-type')
    const format = mimeTypeToExtension(contentType)
    const text = window.api.file.extractText(content, format)

    return {
      title: response.url,
      content: this.extractSearchChunks(text, parameters),
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

  private extractSearchChunks(content: string, parameters: anyDict): string {

    if (!parameters.search || parameters.search.trim().length === 0) {
      return content
    }

    const chunks: string[] = []
    const searchLower = parameters.search.toLowerCase()
    const contentLower = content.toLowerCase()

    let position = 0
    while ((position = contentLower.indexOf(searchLower, position)) !== -1) {
      const beforeLength = Math.floor(parameters.chunkLength / 2)
      const afterLength = parameters.chunkLength

      const start = Math.max(0, position - beforeLength)
      const end = Math.min(content.length, position + parameters.search.length + afterLength)

      let chunk = content.substring(start, end)

      // Add ellipsis if not at boundaries
      if (start > 0) chunk = '...' + chunk
      if (end < content.length) chunk = chunk + '...'

      chunks.push(chunk)

      if (chunks.length >= parameters.maxChunks) {
        break
      }

      // Move position forward to avoid putting twice the same match
      position += parameters.search.length + afterLength
    }

    return chunks.join('\n\n')
  }
}
