
import { LlmEngine, Model } from 'multi-llm-ts'

export type GetChatEnginesOpts = {
  favorites?: boolean
}

export interface ILlmManager {
  
  getChatEngines(opts?: GetChatEnginesOpts): string[]
  
  getEngineName(engine: string): string
  
  getCustomEngines(): string[]
  isCustomEngine(engine: string): boolean
  
  isFavoriteEngine(engine: string): boolean
  getFavoriteId(engine: string, model: string): string
  isFavoriteModel(engine: string, model: string): boolean
  getFavoriteModel(id: string): { engine: string, model: string } | null
  addFavoriteModel(engine: string, model: string): void
  removeFavoriteModel(engine: string, model: string): void
  
  isComputerUseModel(engine: string, model: string): boolean

  getChatEngineModel(acceptSpecializedModels?: boolean): { engine: string, model: string }
  getChatModels(engine: string): Model[]
  getChatModel(engine: string, acceptSpecializedModels?: boolean): string
  setChatModel(engine: string, model: string): void

  isEngineReady(engine: string): boolean
  igniteEngine(engine: string): LlmEngine
  hasChatModels(engine: string): boolean
  canProcessFormat(engine: string, model: string, format: string): boolean

  initModels(): Promise<void>
  loadModels(engine: string): Promise<boolean>
}
