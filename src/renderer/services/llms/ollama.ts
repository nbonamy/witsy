
import { WitsyEngineCreateOpts } from 'types/config'
import { ChatModel, LlmCompletionOpts, ModelOllama, Ollama, OllamaMessage } from 'multi-llm-ts'
import { ChatRequest, } from 'ollama/dist/browser.cjs'

const getChatModels = (): ChatModel[] => {
  
  const ollama = new Ollama({});
  const models = [
    { id: 'deepseek-r1:latest', name: 'DeepSeek R1' },
    { id: 'llama3.3:latest', name: 'Llama 3.3' },
    { id: 'gemma3:latest', name: 'Gemma 3' },
    { id: 'qwen3:latest', name: 'Qwen 3' },
    { id: 'phi4:latest', name: 'Phi 4' },
    { id: 'qwen2.5-coder:latest', name: 'Qwen 2.5 Coder' },
    { id: 'llama3.2-vision:latest', name: 'Llama 3.2 Vision' },
  ].map((model) => ({
    id: model.id,
    name: model.name,
    capabilities: ollama.getModelCapabilities({ name: model.id } as ModelOllama)
  }))
  return models

}

const getEmbeddingModels = () => [
  { id: 'nomic-embed-text-v2-moe', name: 'Nomic Embed Text v2' },
  { id: 'mxbai-embed-large', name: 'MxBai Embed Large' },
  { id: 'bge-m3', name: 'BGE M3' },
  { id: 'snowflake-arctic-embed2', name: 'Snowflake Arctic Embed 2' },
  { id: 'qwen3-embedding', name: 'Qwen 3 Embedding' },
  { id: 'all-minilm', name: 'All MiniLM' },
]

export { getChatModels, getEmbeddingModels }

export default class OllamaEngine extends Ollama {

  declare config: WitsyEngineCreateOpts

  buildChatOptions({ model, messages, opts }: { model: string, messages: OllamaMessage[], opts: LlmCompletionOpts|null }): ChatRequest {
    
    const options = super.buildChatOptions({ model, messages, opts })
    
    const keepAlive = (() => {
      const value = this.config.keepAlive;
      if (!value?.length) {
        return undefined
      }
      if (typeof value === 'string') {
        const num = Number(value);
        return !isNaN(num) ? num : value;
      }
      return value;
    })();

    return {
      ...{ keep_alive: keepAlive },
      ...options
    }
  }

}
