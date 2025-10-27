
import { Expert, ExpertCategory, ExpertData } from 'types/index'
import { app, App } from 'electron'
import { createI18n } from './i18n.base'
import { getLocaleMessages } from './i18n'
import { workspaceFolderPath } from './workspace'
import defaultExpertsData from '../../defaults/experts.json'
import Monitor from './monitor'
import * as window from './window'
import * as file from './file'
import path from 'path'
import fs from 'fs'

const monitor: Monitor = new Monitor(() => {
  window.notifyBrowserWindows('file-modified', 'experts');
});

export const expertsFilePath = (app: App, workspaceId: string): string => {
  const workspacePath = workspaceFolderPath(app, workspaceId)
  return path.join(workspacePath, 'experts.json')
}

export const loadExperts = (source: App|string, workspaceId: string): Expert[] => {
  const expertData = loadExpertData(source, workspaceId)
  return expertData.experts
}

export const saveExperts = (dest: App|string, workspaceId: string, content: Expert[]): void => {
  try {
    const expertData = loadExpertData(dest, workspaceId)
    expertData.experts = content
    saveExpertData(dest, workspaceId, expertData)
  } catch (error) {
    console.log('Error saving experts data', error)
  }
}

export const loadCategories = (source: App|string, workspaceId: string): ExpertCategory[] => {
  const expertData = loadExpertData(source, workspaceId)
  return expertData.categories
}

export const saveCategories = (dest: App|string, workspaceId: string, content: ExpertCategory[]): void => {
  try {
    const expertData = loadExpertData(dest, workspaceId)
    expertData.categories = content
    saveExpertData(dest, workspaceId, expertData)
  } catch (error) {
    console.log('Error saving categories', error)
  }
}

const loadExpertData = (source: App|string, workspaceId: string): ExpertData => {

  // init
  let jsonData: any
  const expertsFile = typeof source === 'string' ? source : expertsFilePath(source, workspaceId)

  // read
  try {
    jsonData = JSON.parse(fs.readFileSync(expertsFile, 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving experts', error)
    }
  }

  // needed
  const defaultCategories = Array.isArray(defaultExpertsData.categories) ? defaultExpertsData.categories : (defaultExpertsData as any).categories
  const defaultExperts = Array.isArray(defaultExpertsData) ? defaultExpertsData : (defaultExpertsData as any).experts

  // migrations can update
  let updated = false

  // migrate old experts format
  const expertData: ExpertData = {
    categories: defaultCategories as ExpertCategory[],
    experts: defaultExperts as Expert[],
  }
  
  if (Array.isArray(jsonData)) {
    expertData.experts = jsonData as Expert[]
    updated = true
  } else if (jsonData?.categories && jsonData?.experts) {
    expertData.categories = jsonData.categories as ExpertCategory[]
    expertData.experts = jsonData.experts as Expert[]
  } else {
    return expertData
  }

  // i18n migrate label and template
  const t = createI18n(getLocaleMessages(app), 'en', { missingWarn: false }).global.t as CallableFunction
  for (const expert of expertData.experts) {

    const defaultExpert = defaultExperts.find((de: Expert) => de.id === expert.id)

    const key = `experts.experts.${expert.id}`
    if (expert.name === t(`${key}.name`)) {
      delete expert.name
      updated = true
    }
    if (expert.prompt === t(`${key}.prompt`)) {
      delete expert.prompt
      updated = true
    }

    // Initialize stats if missing
    if (!expert.stats) {
      expert.stats = { timesUsed: 0 }
      updated = true
    }

    // assign categoryId from defaults for system experts if missing
    if (expert.type === 'system' && !expert.categoryId) {
      if (defaultExpert.categoryId === undefined) {
        expert.categoryId = defaultExpert.categoryId
        updated = true
      }
    }

    // add empty description
    if (expert.type === 'system' && !expert.description) {
      if (defaultExpert?.description) {
        expert.description = defaultExpert.description
        updated = true
      }
    }

  }

  // add new categories
  for (const category of defaultCategories) {
    const c = expertData.categories.find((cat: ExpertCategory) => cat.id === category.id)
    if (c == null) {
      expertData.categories.push(category as ExpertCategory)
      updated = true
    }
  }

  // now add new experts
  for (const prompt of defaultExperts) {
    const p = expertData.experts.find((prt: Expert) => prt.id === prompt.id)
    if (p == null) {
      expertData.experts.push(prompt as Expert)
      updated = true
    }
  }

  // delete deprecated experts
  const deprecated = [
    '6e197c43-1074-479b-89d5-3ab8d54ad36b' // doctor
  ]
  for (const id of deprecated) {
    const index = expertData.experts.findIndex((expert: Expert) => expert.id === id)
    if (index !== -1) {
      expertData.experts.splice(index, 1)
      updated = true
    }
  }

  // save if needed
  if (updated) {
    saveExpertData(source, workspaceId, expertData)
  }

  // start monitoring
  if (typeof source !== 'string') {
    monitor.start(expertsFile)
  }

  // done
  return expertData

}

export const saveExpertData = (dest: App|string, workspaceId: string, content: ExpertData): void => {
  try {
    const expertsFile = typeof dest === 'string' ? dest : expertsFilePath(dest, workspaceId)
    fs.writeFileSync(expertsFile, JSON.stringify(content, null, 2))
  } catch (error) {
    console.log('Error saving experts', error)
  }
}

export const exportExperts = (app: App, workspaceId: string) => {

  // pick a directory
  const filepath = file.pickDirectory(app)
  if (!filepath) {
    return false
  }

  // load defaults file content
  const contents = fs.readFileSync(expertsFilePath(app, workspaceId), 'utf-8')

  // write
  const target = path.join(filepath, 'experts.json')
  fs.writeFileSync(target, contents)
  
  // done
  return true

}

export const importExperts = (app: App, workspaceId: string) => {

  // pick the file
  const filename = file.pickFile(app, { location: true, filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (!filename) {
    return false
  }

  // read and write
  const contents = fs.readFileSync(filename as string, 'utf-8')
  fs.writeFileSync(expertsFilePath(app, workspaceId), contents)

  // done
  return true

}
