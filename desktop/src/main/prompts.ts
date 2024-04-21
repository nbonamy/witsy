
import { Prompt } from '../types/index.d'
import { App } from 'electron'
import defaultPrompts from '../../defaults/prompts.json'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const loadPrompts = (app: App): Prompt[] => {
  return defaultPrompts
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
export const savePrompts = (app: App, content: Prompt[]): void => {
}
