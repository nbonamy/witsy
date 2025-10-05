// CLI State Management

import { CliConfig } from './config'

export interface CLIState {
  port: number
  engine: string
  model: string
  history: Array<{ role: string; content: string }>
  userDataPath: string
  cliConfig: CliConfig | null
}

export const state: CLIState = {
  port: 8090,
  engine: '',
  model: '',
  history: [],
  userDataPath: '',
  cliConfig: null
}
