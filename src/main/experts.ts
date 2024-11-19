
import { Expert } from 'types/index.d'
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

export const loadExperts = (source: App|string): Expert[] => {

  // init
  let experts: Expert[] = []

  // read
  try {
    const expertsFile = typeof source === 'string' ? source : expertsFilePath(source)
    experts = JSON.parse(fs.readFileSync(expertsFile, 'utf-8'))
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
    } else if (p.type == 'system') {
      p.prompt = prompt.prompt
      updated = true
    }
  }

  // save if needed
  if (updated) {
    saveExperts(source, experts)
  }

  // done
  return experts

}

export const saveExperts = (dest: App|string, content: Expert[]): void => {
  try {
    const expertsFile = typeof dest === 'string' ? dest : expertsFilePath(dest)
    fs.writeFileSync(expertsFile, JSON.stringify(content, null, 2))
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
