#!/usr/bin/env npx ts-node

import * as fs from 'fs'
import * as path from 'path'
import en from '@root/locales/en.json'

// Function to sort a dictionary recursively
function sortObjectRecursively(locale: string, path: string, obj: any): any {
  
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if ([ 'common.language' ].includes(path.substring(1))) {
    return obj
  }

  if (locale === 'en' && [ 'commands.commands', 'experts.experts' ].includes(path.substring(1))) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item: any) => sortObjectRecursively(locale, path, item))
  }

  // Get all keys and sort:
  // - "common" should be first
  // - commands and experts are sorted as in English version
  const keys = Object.keys(obj)
  const sortedKeys = keys.sort((a, b) => {

    // commands
    if (path.startsWith('.commands.commands')) {
      const aIndex = Object.keys(en.commands.commands).indexOf(a)
      const bIndex = Object.keys(en.commands.commands).indexOf(b)
      return aIndex - bIndex
    }

    // experts
    if (path.startsWith('.experts.experts')) {
      const aIndex = Object.keys(en.experts.experts).indexOf(a)
      const bIndex = Object.keys(en.experts.experts).indexOf(b)
      return aIndex - bIndex
    }

    // If one of the keys is "common", it should come first
    if (a === 'common') return -1
    if (b === 'common') return 1

    // Otherwise, sort alphabetically
    return a.localeCompare(b)
  
  })


  const result: any = {}

  for (const key of sortedKeys) {
    result[key] = sortObjectRecursively(locale, `${path}.${key}`, obj[key])
  }

  return result
}

// Function to process a single JSON file
function processJsonFile(filePath: string): void {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    const locale = path.basename(filePath, '.json')
    const json = JSON.parse(data)
    const sortedJson = sortObjectRecursively(locale, '', json)
    fs.writeFileSync(filePath, JSON.stringify(sortedJson, null, 2) + '\n', 'utf8')
    console.log(`Processed: ${filePath}`)
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error)
  }
}

// Function to find all JSON files in a directory
function processDirectory(dir: string): void {
  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      processDirectory(fullPath)
    } else if (file.endsWith('.json')) {
      processJsonFile(fullPath)
    }
  })
}

// Main function
export function sortLocales(): void {
  const localesDir = path.resolve('./locales')
  
  if (!fs.existsSync(localesDir)) {
    console.error(`Directory not found: ${localesDir}`)
    process.exit(1)
  }

  console.log(`⏭️ Sorting JSON files in ${localesDir}`)
  processDirectory(localesDir)
  console.log('✅ Done!')
}

// If this file is run directly (not imported), execute sortLocales
if (require.main === module) {
  sortLocales()
}
