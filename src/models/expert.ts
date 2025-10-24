
import { Expert as ExpertBase, ExternalApp } from '../types'

export default class Expert implements ExpertBase {

  id: string;
  type: 'system' | 'user';
  name?: string;
  prompt?: string;
  description?: string;
  categoryId?: string;
  engine?: string;
  model?: string;
  state: 'enabled' | 'disabled' | 'deleted';
  triggerApps: ExternalApp[];
  stats?: {
    timesUsed: number;
    lastUsed?: number;
  };

  static fromJson(obj: any): Expert {
    const expert = new Expert()
    expert.id = obj.id
    expert.type = obj.type
    expert.name = obj.name
    expert.prompt = obj.prompt
    expert.description = obj.description
    expert.categoryId = obj.categoryId
    expert.engine = obj.engine
    expert.model = obj.model
    expert.state = obj.state
    expert.triggerApps = []
    expert.stats = obj.stats
    return expert
  }

}