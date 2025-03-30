
import { Expert as ExpertBase, ExternalApp } from '../types'

export default class Expert implements ExpertBase {
  
  id: string;
  type: 'system' | 'user';
  name?: string;
  prompt?: string;
  state: 'enabled' | 'disabled' | 'deleted';
  triggerApps: ExternalApp[];

  static fromJson(obj: any): Expert {
    const expert = new Expert()
    expert.id = obj.id
    expert.type = obj.type
    expert.name = obj.name
    expert.prompt = obj.prompt
    expert.state = obj.state
    expert.triggerApps = []
    return expert
  }

}