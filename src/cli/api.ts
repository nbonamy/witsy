// Witsy API Client

import { state } from './state'

export class WitsyAPI {
  private baseUrl(): string {
    return `http://localhost:${state.port}`
  }

  async getConfig(): Promise<{ engine: string; model: string; userDataPath: string }> {
    const response = await fetch(`${this.baseUrl()}/api/cli/config`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return { engine: data.engine, model: data.model, userDataPath: data.userDataPath }
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

  async complete(thread: Array<{ role: string; content: string }>, onChunk: (text: string) => void): Promise<void> {
    const response = await fetch(`${this.baseUrl()}/api/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stream: 'true',
        engine: state.engine,
        model: state.model,
        thread
      })
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
}
