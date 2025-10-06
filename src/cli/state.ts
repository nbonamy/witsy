// CLI State Management

import { CliConfig } from './config'
import { ChatCli } from './models'

export interface CLIState {
  port: number
  engine: string
  model: string
  chat: ChatCli
  userDataPath: string
  cliConfig: CliConfig | null
}

export const state: CLIState = {
  port: 8090,
  engine: '',
  model: '',
  chat: new ChatCli('CLI Session'),
  userDataPath: '',
  cliConfig: null
}
