// CLI State Management

import { CliConfig } from './config'
import { Root } from './components'
import { ChatCli } from './models'

export type WorkDirAccess = 'none' | 'ro' | 'rw'

export interface WorkDir {
  path: string | null
  access: WorkDirAccess
}

export interface CLIState {
  port: number
  debug: boolean
  engine: { id: string; name: string } | null
  model: { id: string; name: string } | null
  chat: ChatCli
  userDataPath: string
  cliConfig: CliConfig | null
  workDir: WorkDir
  componentTree: Root | null
}

export const state: CLIState = {
  port: 8090,
  debug: false,
  engine: null,
  model: null,
  chat: new ChatCli('CLI Session'),
  userDataPath: '',
  cliConfig: null,
  workDir: {
    path: null,
    access: 'none'
  },
  componentTree: null
}
