// CLI State Management

import { CliConfig } from './config'
import Chat from '../models/chat'

export interface CLIState {
  port: number
  engine: string
  model: string
  chat: Chat
  userDataPath: string
  cliConfig: CliConfig | null
}

export const state: CLIState = {
  port: 8090,
  engine: '',
  model: '',
  chat: new Chat('CLI Session'),
  userDataPath: '',
  cliConfig: null
}

// Initialize with empty UUID (not saved yet)
state.chat.uuid = ''
