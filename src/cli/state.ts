// CLI State Management

import { CliConfig } from './config'
import { ChatCli } from './models'

export interface CLIState {
  port: number
  engine: { id: string; name: string } | null
  model: { id: string; name: string } | null
  chat: ChatCli
  userDataPath: string
  cliConfig: CliConfig | null
}

export const state: CLIState = {
  port: 8090,
  engine: null,
  model: null,
  chat: new ChatCli('CLI Session'),
  userDataPath: '',
  cliConfig: null
}
