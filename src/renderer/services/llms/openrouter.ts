
import { WitsyEngineCreateOpts } from 'types/config'
import { ChatModel, LlmCompletionOpts,  OpenRouter } from 'multi-llm-ts'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'

export default class OpenRouterEngine extends OpenRouter {

  declare config: WitsyEngineCreateOpts

  getCompletionOpts(model: ChatModel, opts?: LlmCompletionOpts): Omit<ChatCompletionCreateParamsBase, 'model' | 'messages' | 'stream'> {

    // build provider preferences
    const providerOrder = this.config.providerOrder?.trim()
    const providers = providerOrder?.length
      ? providerOrder.split('\n').map(p => p.trim()).filter(p => p.length)
      : []
    const sort = this.config.providerSort
    const dataCollection = this.config.providerDataCollection
    const allowFallbacks = this.config.providerAllowFallbacks

    const hasCustomProvider = providers.length > 0 || sort || dataCollection || allowFallbacks === false

    if (hasCustomProvider) {
      const provider: Record<string, unknown> = {
        allow_fallbacks: allowFallbacks ?? true,
      }
      if (providers.length) provider.order = providers
      if (sort) provider.sort = sort
      if (dataCollection) provider.data_collection = dataCollection
      if (!opts) opts = { customOpts: {} }
      if (!opts.customOpts) opts.customOpts = {}
      opts.customOpts.provider = provider
    }

    // done
    return super.getCompletionOpts(model, opts)

  }

}
