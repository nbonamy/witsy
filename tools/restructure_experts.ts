#!/usr/bin/env tsx

import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const mappingPath = path.join(__dirname, '../plans/experts-category-mapping.json')
const expertsPath = path.join(__dirname, '../defaults/experts.json')
const localePath = path.join(__dirname, '../locales/en.json')

console.log('Reading files...')
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))
const currentExperts = JSON.parse(fs.readFileSync(expertsPath, 'utf-8'))
const locale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))

// Generate UUIDs for categories
console.log('Generating category UUIDs...')
const categoryKeyToId: Record<string, string> = {}
const categories = []

for (const [key, def] of Object.entries(mapping.categoryDefinitions)) {
  const id = randomUUID()
  categoryKeyToId[key] = id
  categories.push({
    id,
    type: 'system',
    state: 'enabled',
    icon: (def as any).icon,
    color: (def as any).color
  })
  
  // Add to locale
  if (!locale.experts.categories) {
    locale.experts.categories = {}
  }
  locale.experts.categories[id] = {
    name: (def as any).label,
    description: (def as any).description
  }
}

console.log(`Created ${categories.length} categories`)

// Update experts with categoryId
console.log('Updating experts with categoryId...')
const experts = currentExperts.map((expert: any) => {
  const expertMapping = mapping.expertMappings[expert.id]
  if (expertMapping) {
    const categoryKey = expertMapping.category
    expert.categoryId = categoryKeyToId[categoryKey]
    
    // Add description to locale
    if (!locale.experts.experts[expert.id]) {
      locale.experts.experts[expert.id] = {}
    }
    locale.experts.experts[expert.id].description = expertMapping.description
  }
  return expert
})

console.log(`Updated ${experts.length} experts`)

// Create new structure
const newStructure = {
  categories,
  experts
}

// Write files
console.log('Writing defaults/experts.json...')
fs.writeFileSync(expertsPath, JSON.stringify(newStructure, null, 2) + '\n')

console.log('Writing locales/en.json...')
fs.writeFileSync(localePath, JSON.stringify(locale, null, 2) + '\n')

console.log('Done!')
console.log(`- ${categories.length} categories created`)
console.log(`- ${experts.length} experts updated with categoryId`)
console.log(`- Category names/descriptions added to locales`)
console.log(`- Expert descriptions added to locales`)
