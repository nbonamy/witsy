
import { Expert, ExpertCategory } from 'types/index'
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

// Handle both old and new format
const defaultExperts = Array.isArray(defaultExpertsData) ? defaultExpertsData : (defaultExpertsData as any).experts
const defaultCategories: ExpertCategory[] = Array.isArray(defaultExpertsData) ? [] : (defaultExpertsData as any).categories

const monitor: Monitor = new Monitor(() => {
  window.notifyBrowserWindows('file-modified', 'experts');
});

export const expertsFilePath = (app: App, workspaceId: string): string => {
  const workspacePath = workspaceFolderPath(app, workspaceId)
  return path.join(workspacePath, 'experts.json')
}

export const categoriesFilePath = (app: App, workspaceId: string): string => {
  const workspacePath = workspaceFolderPath(app, workspaceId)
  return path.join(workspacePath, 'categories.json')
}

export const loadCategories = (source: App|string, workspaceId: string): ExpertCategory[] => {
  let categories: ExpertCategory[] = []
  const categoriesFile = typeof source === 'string' ? source : categoriesFilePath(source, workspaceId)

  // Try to load from file
  try {
    categories = JSON.parse(fs.readFileSync(categoriesFile, 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving categories', error)
    }
  }

  // Merge with defaults
  let updated = false
  for (const defaultCat of defaultCategories) {
    const existing = categories.find(c => c.id === defaultCat.id)
    if (!existing) {
      categories.push(defaultCat)
      updated = true
    }
  }

  // Save if updated
  if (updated) {
    saveCategories(source, workspaceId, categories)
  }

  return categories
}

export const saveCategories = (dest: App|string, workspaceId: string, content: ExpertCategory[]): void => {
  try {
    const categoriesFile = typeof dest === 'string' ? dest : categoriesFilePath(dest, workspaceId)
    fs.writeFileSync(categoriesFile, JSON.stringify(content, null, 2))
  } catch (error) {
    console.log('Error saving categories', error)
  }
}

export const loadExperts = (source: App|string, workspaceId: string): Expert[] => {

  // init
  let experts: Expert[] = []
  const expertsFile = typeof source === 'string' ? source : expertsFilePath(source, workspaceId)

  // read
  try {
    experts = JSON.parse(fs.readFileSync(expertsFile, 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving experts', error)
    }
  }

  // migrations can update
  let updated = false

  // i18n migrate label and template
  const t = createI18n(getLocaleMessages(app), 'en', { missingWarn: false }).global.t as CallableFunction
  for (const expert of experts) {
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

    // Assign categoryId from defaults for system experts if missing
    if (expert.type === 'system' && !expert.categoryId) {
      const defaultExpert = defaultExperts.find((de: Expert) => de.id === expert.id)
      if (defaultExpert?.categoryId) {
        expert.categoryId = defaultExpert.categoryId
        updated = true
      }
    }

    // User experts without categoryId remain uncategorized (undefined)

    // Remove old category field if it exists (backward compatibility)
    if ((expert as any).category) {
      delete (expert as any).category
      updated = true
    }
  }
  
  // now add new experts
  for (const prompt of defaultExperts) {
    const p = experts.find((prt: Expert) => prt.id === prompt.id)
    if (p == null) {
      experts.push(prompt as Expert)
      updated = true
    }
  }

  // delete deprecated experts
  const deprecated = [
    '6e197c43-1074-479b-89d5-3ab8d54ad36b' // doctor
  ]
  for (const id of deprecated) {
    const index = experts.findIndex((expert: Expert) => expert.id === id)
    if (index !== -1) {
      experts.splice(index, 1)
      updated = true
    }
  }

  // save if needed
  if (updated) {
    saveExperts(source, workspaceId, experts)
  }

  // start monitoring
  if (typeof source !== 'string') {
    monitor.start(expertsFile)
  }

  // done
  return experts

}

export const saveExperts = (dest: App|string, workspaceId: string, content: Expert[]): void => {
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
