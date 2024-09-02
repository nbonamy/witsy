
import { Prompt } from '../types/index.d'
import { App } from 'electron'
import defaultPrompts from '../../defaults/prompts.json'
import * as file from './file'
import path from 'path'
import fs from 'fs'

const promptsFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const promptsFilePath = path.join(userDataPath, 'prompts.json')
  return promptsFilePath
}

export const loadPrompts = (app: App): Prompt[] => {

  // init
  let prompts: Prompt[] = []

  // read
  try {
    prompts = JSON.parse(fs.readFileSync(promptsFilePath(app), 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving prompts', error)
    }
  }

  // now add new prompts
  let updated = false
  for (const prompt of defaultPrompts) {
    const p = prompts.find((prt: Prompt) => prt.id === prompt.id)
    if (p == null) {
      prompts.push(prompt as Prompt)
      updated = true
    }
  }

  // save if needed
  if (updated) {
    savePrompts(app, prompts)
  }

  // done
  return prompts

}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
export const savePrompts = (app: App, content: Prompt[]): void => {
  try {
    fs.writeFileSync(promptsFilePath(app), JSON.stringify(content, null, 2))
  } catch (error) {
    console.log('Error saving prompts', error)
  }
}

export const exportPrompts = (app: App) => {

  // pick a directory
  const filepath = file.pickDirectory(app)
  if (!filepath) {
    return false
  }

  // load defaults file content
  const contents = fs.readFileSync(promptsFilePath(app), 'utf-8')

  // write
  const target = path.join(filepath, 'prompts.json')
  fs.writeFileSync(target, contents)
  
  // done
  return true

}

export const importCommands = (app: App) => {

  // pick the file
  const filename = file.pickFile(app, { location: true, filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (!filename) {
    return false
  }

  // read and write
  const contents = fs.readFileSync(filename as string, 'utf-8')
  fs.writeFileSync(promptsFilePath(app), contents)

  // done
  return true

}
