
import { WitsyEngineCreateOpts } from '../types/config'
import { ChatModel, LlmCompletionOpts,  OpenRouter } from 'multi-llm-ts'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'

export default class OpenRouterEngine extends OpenRouter {

  declare config: WitsyEngineCreateOpts

  getCompletionOpts(model: ChatModel, opts?: LlmCompletionOpts): Omit<ChatCompletionCreateParamsBase, 'model' | 'messages' | 'stream'> {
    
    // check providerOrder
    const providerOrder = this.config.providerOrder?.trim()
    if (providerOrder?.length) {
      const providers = providerOrder.split('\n').map(p => p.trim()).filter(p => p.length)
      if (providers.length) {
        if (!opts) opts = { customOpts: {} }
        opts.customOpts.provider = {
          allow_fallbacks: true,
          order: providers
        }
      }
    }

    // done
    return super.getCompletionOpts(model, opts)

  }

}
