
import { FavoriteModel } from '../types/config'
import { ToolSelection } from '../types/llm'

export default class Workspace {

  uuid: string
  name: string
  icon: string
  color: string
  
  models: FavoriteModel[]
  experts: string[]
  docrepos: string[]
  tools?: ToolSelection[]

  constructor(name: string) {
    this.uuid = crypto.randomUUID()
    this.name = name
  }

  static fromJson(obj: any): Workspace {
    const workspace = new Workspace(obj.name);
    workspace.uuid = obj.uuid;
    workspace.icon = obj.icon;
    workspace.color = obj.color;
    workspace.models = obj.models;
    workspace.experts = obj.experts;
    workspace.docrepos = obj.docrepos;
    workspace.tools = obj.tools;
    return workspace;
  }

}