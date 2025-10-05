// CLI State Management

export interface CLIState {
  port: number
  engine: string
  model: string
  history: Array<{ role: string; content: string }>
}

export const state: CLIState = {
  port: 8090,
  engine: '',
  model: '',
  history: []
}
