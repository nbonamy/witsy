#!/usr/bin/env npx ts-node

import * as fs from 'fs'
import * as path from 'path'

// Function to sort a dictionary recursively
function sortObjectRecursively(path: string, obj: any): any {
  
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if ([ 'common.language', 'commands.commands', 'experts.experts' ].includes(path.substring(1))) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectRecursively)
  }

  // Get all keys and sort them with special treatment for "common"
  const keys = Object.keys(obj)
  const sortedKeys = keys.sort((a, b) => {
    // If one of the keys is "common", it should come first
    if (a === 'common') return -1
    if (b === 'common') return 1
    // Otherwise, sort alphabetically
    return a.localeCompare(b)
  })

  const result: any = {}

  for (const key of sortedKeys) {
    result[key] = sortObjectRecursively(`${path}.${key}`, obj[key])
  }

  return result
}

// Function to process a single JSON file
function processJsonFile(filePath: string): void {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    const json = JSON.parse(data)
    const sortedJson = sortObjectRecursively('', json)
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
function main(): void {
  const localesDir = path.resolve('./locales')
  
  if (!fs.existsSync(localesDir)) {
    console.error(`Directory not found: ${localesDir}`)
    process.exit(1)
  }

  console.log(`Sorting JSON files in ${localesDir}`)
  processDirectory(localesDir)
  console.log('Done!')
}

main()