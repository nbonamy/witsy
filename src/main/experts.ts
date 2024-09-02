
import { Expert } from '../types'
import { App } from 'electron'
import defaultExperts from '../../defaults/experts.json'
import * as file from './file'
import path from 'path'
import fs from 'fs'

const expertsFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const expertsFilePath = path.join(userDataPath, 'experts.json')
  return expertsFilePath
}

export const loadExperts = (app: App): Expert[] => {

  // init
  let experts: Expert[] = []

  // read
  try {
    experts = JSON.parse(fs.readFileSync(expertsFilePath(app), 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving experts', error)
    }
  }

  // now add new experts
  let updated = false
  for (const prompt of defaultExperts) {
    const p = experts.find((prt: Expert) => prt.id === prompt.id)
    if (p == null) {
      experts.push(prompt as Expert)
      updated = true
    }
  }

  // save if needed
  if (updated) {
    saveExperts(app, experts)
  }

  // done
  return experts

}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
export const saveExperts = (app: App, content: Expert[]): void => {
  try {
    fs.writeFileSync(expertsFilePath(app), JSON.stringify(content, null, 2))
  } catch (error) {
    console.log('Error saving experts', error)
  }
}

export const exportExperts = (app: App) => {

  // pick a directory
  const filepath = file.pickDirectory(app)
  if (!filepath) {
    return false
  }

  // load defaults file content
  const contents = fs.readFileSync(expertsFilePath(app), 'utf-8')

  // write
  const target = path.join(filepath, 'experts.json')
  fs.writeFileSync(target, contents)
  
  // done
  return true

}

export const importExperts = (app: App) => {

  // pick the file
  const filename = file.pickFile(app, { location: true, filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (!filename) {
    return false
  }

  // read and write
  const contents = fs.readFileSync(filename as string, 'utf-8')
  fs.writeFileSync(expertsFilePath(app), contents)

  // done
  return true

}
