import { FavoriteModel } from "./config"
import { ToolSelection } from "./llm"

export type WorkspaceHeader = {
  uuid: string
  name: string
  icon?: string
  color?: string
}

export type WebApp = {
  id: string
  name: string
  url: string
  icon: string
  enabled: boolean
  lastUsed?: number
}

export type Workspace = WorkspaceHeader & {
  models?: FavoriteModel[]
  experts?: string[]
  docrepos?: string[]
  tools?: ToolSelection[]
  webapps?: WebApp[]
}
