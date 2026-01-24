
import Perplexity from '@perplexity-ai/perplexity_ai'
import { Exa } from 'exa-js'
import { convert } from 'html-to-text'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import { anyDict, LocalSearchResponse } from 'types/index'
import Tavily from '@/vendor/tavily'
import { t } from '../i18n'
import { executeIpcWithAbort } from './ipc_abort_helper'
import Plugin, { PluginConfig } from './plugin'

export const kSearchPluginName = 'search_internet'

export type SearchResultItem = {
  title: string
  url: string
  content: string
}

export type SearchResult = {
  query: string
  results: SearchResultItem[]
}

export type SearchResponse = {
  query?: string
  results?: SearchResultItem[]
  error?: string
}

export default class extends Plugin {

  maxResults?: number
  titlesOnly?: boolean

  constructor(config: PluginConfig, workspaceId: string) {
    super(config, workspaceId)
    this.titlesOnly = false
  }

  isEnabled(): boolean {
    return this.config?.enabled && (
      (this.config.engine == 'local') ||
      (this.config.engine == 'brave' && this.config.braveApiKey?.trim().length > 0) ||
      (this.config.engine == 'exa' && this.config.exaApiKey?.trim().length > 0) ||
      (this.config.engine == 'google' && this.config.googleApiKey?.trim().length > 0 && this.config.googleSearchEngineId?.trim().length > 0) ||
      (this.config.engine == 'perplexity' && this.config.perplexityApiKey?.trim().length > 0) ||
      (this.config.engine == 'tavily' && this.config.tavilyApiKey?.trim().length > 0) ||
      (this.config.engine == 'searxng' && this.config.searxngUrl?.trim().length > 0)
    )
  }

  getName(): string {
    return kSearchPluginName
  }

  getDescription(): string {
    return 'This tool allows you to search the web for information on a given topic. Try to include links to the sources you use in your response.'
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }

  getRunningDescription(): string {
    return t('plugins.search.running')
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    if (!results || !results.results || results.error) {
      return t('plugins.search.error')
    } else {
      return t('plugins.search.completed', { query: args.query, count: results.results.length })
    }
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'query',
        type: 'string',
        description: 'The query to search for',
        required: true
      },
      {
        name: 'maxResults',
        type: 'number',
        description: 'The maximum number of results to return',
        required: false,
      }
    ]
  }

  setMaxResults(max: number) {
    this.maxResults = max
  }

  setTitlesOnly(titlesOnly: boolean) {
    this.titlesOnly = titlesOnly
  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<SearchResponse> {

    const maxResults = this.maxResults ?? (parameters.maxResults || this.config.maxResults || 5)
    
    let response: SearchResponse = { error: 'Not implemented' }
    
    if (this.config.engine === 'local') {
      response = await this.local(context, parameters, maxResults)
    } else if (this.config.engine === 'brave') {
      response = await this.brave(context, parameters, maxResults)
    } else if (this.config.engine === 'exa') {
      response = await this.exa(context, parameters, maxResults)
    } else if (this.config.engine === 'google') {
      response = await this.google(context, parameters, maxResults)
    } else if (this.config.engine === 'perplexity') {
      response = await this.perplexity(context, parameters, maxResults)
    } else if (this.config.engine === 'tavily') {
      response = await this.tavily(context, parameters, maxResults)
    } else if (this.config.engine === 'searxng') {
      response = await this.searxng(context, parameters, maxResults)
    } else {
      response = { error: 'Invalid engine' }
    }

    // if error nothing to do
    if (response.error || !response.results) {
      return response
    }

    // process content
    for (const result of response.results) {
      if (this.titlesOnly) {
        delete result.content
      } else {
        result.content = this.truncateContent(result.content)
      }
    }

    // done
    return response

  }

  async local(context: PluginExecutionContext, parameters: anyDict, maxResults: number): Promise<SearchResponse> {

    try {
      const response: LocalSearchResponse = await executeIpcWithAbort(
        (signalId) => window.api.search.query(parameters.query, maxResults, signalId),
        (signalId) => window.api.search.cancel(signalId),
        context.abortSignal
      )

      if (response.error || !response.results) {
        return { error: response.error }
      }
      
      return {
        query: parameters.query,
        results: response.results.map(result => ({
          title: result.title,
          url: result.url,
          content: result.content || (result.html ? this.htmlToText(result.html) : '')
        }))
      }

    } catch (error) {
      return { error: error.message }
    }
  }

  async brave(context: PluginExecutionContext, parameters: anyDict, maxResults: number): Promise<SearchResponse> {

    try {

      const baseUrl = 'https://api.search.brave.com/res/v1/web/search'
      const response = await this.runWithAbort(
        fetch(`${baseUrl}?q=${encodeURIComponent(parameters.query)}&count=${maxResults}`, {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': this.config.braveApiKey
          },
          signal: context.abortSignal
        }),
        context.abortSignal
      )

      const data = await response.json()

      // content returned by brave is very short
      await this.enrichResultsWithContent(data.web.results, context)

      return {
        query: parameters.query,
        results: data.web.results.map((result: any) => ({
          url: result.url,
          title: result.title,
          content: result.content
        }))
      }

    } catch (error) {
      return { error: error.message }
    }
  }

  async exa(context: PluginExecutionContext, parameters: anyDict, maxResults: number): Promise<SearchResponse> {

    try {

      const exa = new Exa(this.config.exaApiKey)
      const results = await this.runWithAbort(
        exa.searchAndContents(parameters.query, {
          text: true,
          numResults: maxResults,
        }),
        context.abortSignal
      )

      return {
        query: parameters.query,
        results: results.results.map(result => ({
          title: result.title,
          url: result.url,
          content: result.text
        }))
      }

    } catch (error) {
      return { error: error.message }
    }

  }

  async google(context: PluginExecutionContext, parameters: anyDict, maxResults: number): Promise<SearchResponse> {

    try {

      const baseUrl = 'https://www.googleapis.com/customsearch/v1'
      const params = new URLSearchParams({
        key: this.config.googleApiKey,
        cx: this.config.googleSearchEngineId,
        q: parameters.query,
        num: Math.min(maxResults, 10).toString() // Google API max is 10 per request
      })

      const response = await this.runWithAbort(
        fetch(`${baseUrl}?${params}`, {
          headers: {
            'Accept': 'application/json',
          },
          signal: context.abortSignal
        }),
        context.abortSignal
      )

      const data = await response.json()

      if (data.error) {
        return { error: data.error.message || 'Google search failed' }
      }

      // Map to our result format
      const results = (data.items || []).map((item: any) => ({
        title: item.title,
        url: item.link,
        content: item.snippet
      }))

      // content returned by Google is very short (snippet)
      await this.enrichResultsWithContent(results, context)

      return {
        query: parameters.query,
        results
      }

    } catch (error) {
      return { error: error.message }
    }
  }

  async perplexity(context: PluginExecutionContext, parameters: anyDict, maxResults: number): Promise<SearchResponse> {

    try {

      // perplexity
      const perplexity = new Perplexity({ apiKey: this.config.perplexityApiKey })
      const results = await this.runWithAbort(
        perplexity.search.create({
          query: parameters.query,
          max_results: maxResults,
        }),
        context.abortSignal
      ) as unknown as SearchResponse

      // no content returned by perplexity
      await this.enrichResultsWithContent(results.results, context)

      // done
      const response = {
        query: parameters.query,
        results: results.results.map(result => ({
          title: result.title,
          url: result.url,
          content: result.content
        }))
      }
      //console.log('Tavily response:', response)
      return response

    } catch (error) {
      return { error: error.message }
    }
  }

  async tavily(context: PluginExecutionContext, parameters: anyDict, maxResults: number): Promise<SearchResponse> {

    try {

      // tavily
      const tavily = new Tavily(this.config.tavilyApiKey)
      const results = await this.runWithAbort(
        tavily.search(parameters.query, {
          max_results: maxResults,
          //include_answer: true,
          //include_raw_content: true,
        }),
        context.abortSignal
      )

      // content returned by tavily is very short
      await this.enrichResultsWithContent(results.results, context)

      // done
      const response = {
        query: parameters.query,
        results: results.results.map(result => ({
          title: result.title,
          url: result.url,
          content: result.content
        }))
      }
      //console.log('Tavily response:', response)
      return response

    } catch (error) {
      return { error: error.message }
    }
  }

  async searxng(context: PluginExecutionContext, parameters: anyDict, maxResults: number): Promise<SearchResponse> {

    try {

      // build the search URL
      const baseUrl = this.config.searxngUrl.replace(/\/$/, '')
      const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(parameters.query)}&format=json`

      const response = await this.runWithAbort(
        fetch(searchUrl, {
          headers: {
            'Accept': 'application/json',
          },
          signal: context.abortSignal
        }),
        context.abortSignal
      )

      const data = await response.json()

      // SearXNG returns results in data.results array
      // content in SearXNG is often brief, so enrich with full content
      const results = (data.results || []).slice(0, maxResults)
      await this.enrichResultsWithContent(results, context)

      return {
        query: parameters.query,
        results: results.map((result: any) => ({
          title: result.title,
          url: result.url,
          content: result.content
        }))
      }

    } catch (error) {
      return { error: error.message }
    }
  }

  htmlToText(html: string): string {

    // if we find a main section then let's convert that only
    const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (main) {
      html = main[0]
    }

    let text = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: 'nav', format: 'skip' },
        { selector: 'img', format: 'skip' },
        { selector: 'form', format: 'skip' },
        { selector: 'button', format: 'skip' },
        { selector: 'input', format: 'skip' },
        { selector: 'select', format: 'skip' },
        { selector: 'a', format: 'skip' },
      ]
    })

    // Clean up repeated bullet points and excessive whitespace
    text = text.replace(/(\n\s*\*\s*)+/g, '\n* ')  // Remove repeated "* " sequences
    text = text.replace(/\*\s*\*\s*/g, '')         // Remove "* * " patterns
    text = text.replace(/\n\s*-{3,}\s*\n/g, '\n')  // Remove horizontal rules (--- or more)
    text = text.replace(/\n{3,}/g, '\n\n')         // Reduce multiple newlines to max 2
    text = text.trim()

    return text
  }

  truncateContent(content: string): string {
    if (!this.config.contentLength) {
      return content
    } else {
      return content.slice(0, this.config.contentLength)
    }
  }

  /**
   * Fetches HTML content from URLs and converts to text.
   * Used by search engines that don't return full content.
   *
   * @param results - Search results with URLs to fetch
   * @param context - Plugin execution context with abort signal
   * @private
   */
  private async enrichResultsWithContent(
    results: SearchResultItem[],
    context: PluginExecutionContext
  ): Promise<void> {
    await Promise.all(
      results.map(async (result) => {
        const html = await this.runWithAbort(
          fetch(result.url, { signal: context.abortSignal }).then(response => response.text()),
          context.abortSignal
        )
        result.content = this.htmlToText(html)
      })
    )
  }

}
