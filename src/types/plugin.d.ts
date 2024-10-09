
declare module 'html-to-text'

import { LlmToolParameterOpenAI } from './llm'

export type PluginConfig = anyDict

export type PluginParameter = LlmToolParameterOpenAI
