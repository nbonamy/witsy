// Witsy API Client

import { state } from './state'
import Chat from '../models/chat'

export class WitsyAPI {
  private baseUrl(): string {
    return `http://localhost:${state.port}`
  }

  async connectWithTimeout(port: number, timeoutMs: number): Promise<boolean> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`http://localhost:${port}/api/cli/config`, {
        signal: controller.signal
      })
      clearTimeout(timeout)
      return response.ok
    } catch {
      clearTimeout(timeout)
      return false
    }
  }

  async getConfig(): Promise<{ engine: string; model: string; userDataPath: string; enableHttpEndpoints: boolean }> {
    const response = await fetch(`${this.baseUrl()}/api/cli/config`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return {
      engine: data.engine,
      model: data.model,
      userDataPath: data.userDataPath,
      enableHttpEndpoints: data.enableHttpEndpoints
    }
  }

  async getEngines(): Promise<Array<{ id: string; name: string }>> {
    const response = await fetch(`${this.baseUrl()}/api/engines`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return data.engines
  }

  async getModels(engine: string): Promise<Array<{ id: string; name: string }>> {
    const response = await fetch(`${this.baseUrl()}/api/models/${engine}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return data.models
  }

  async complete(thread: Array<{ role: string; content: string }>, onChunk: (text: string) => void, signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${this.baseUrl()}/api/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stream: 'true',
        engine: state.engine,
        model: state.model,
        noMarkdown: true,
        thread
      }),
      signal
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return

          try {
            onChunk(data)
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  async saveConversation(chat: Chat): Promise<string> {
    const response = await fetch(`${this.baseUrl()}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat })
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    return data.chatId
  }
}
