
declare module 'html-to-text'

export type PluginConfig = anyDict

export interface PluginParameter {
  name: string
  description: string
  type: string
  enum?: string[]
  required?: boolean
}
