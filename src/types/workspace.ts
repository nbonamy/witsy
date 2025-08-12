import { FavoriteModel } from "./config"
import { ToolSelection } from "./llm"

export type WorkspaceHeader = {
  uuid: string
  name: string
  icon?: string
  color?: string
}

export type Workspace = WorkspaceHeader & {
  models?: FavoriteModel[]
  experts?: string[]
  docrepos?: string[]
  tools?: ToolSelection[]
}
