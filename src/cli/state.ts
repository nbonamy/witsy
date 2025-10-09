import { CliConfig } from './config'
import { ChatCli } from './models'

export interface CLIState {
  port: number
  debug: boolean
  showReasoning: boolean
  engine: { id: string; name: string } | null
  model: { id: string; name: string } | null
  chat: ChatCli
  userDataPath: string
  cliConfig: CliConfig | null
}

export const state: CLIState = {
  port: 8090,
  debug: false,
  showReasoning: false,
  engine: null,
  model: null,
  chat: new ChatCli('CLI Session'),
  userDataPath: '',
  cliConfig: null
}
