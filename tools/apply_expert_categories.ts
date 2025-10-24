#!/usr/bin/env tsx

import * as fs from 'fs'
import * as path from 'path'

const mappingPath = path.join(__dirname, '../plans/experts-category-mapping.json')
const localePath = path.join(__dirname, '../locales/en.json')

console.log('Reading expert category mapping...')
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))

console.log('Reading en.json locale file...')
const locale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))

console.log('Applying categories and descriptions to experts...')
let updated = 0

for (const [expertId, expertData] of Object.entries(mapping.expertMappings)) {
  const expertLocale = locale.experts.experts[expertId]
  if (expertLocale) {
    // Add description to locale
    expertLocale.description = (expertData as any).description
    updated++
  } else {
    console.warn(`Warning: Expert ${expertId} not found in locales`)
  }
}

console.log(`Updated ${updated} experts with descriptions`)

console.log('Writing updated locale file...')
fs.writeFileSync(localePath, JSON.stringify(locale, null, 2) + '\n', 'utf-8')

console.log('Done! All expert descriptions added to en.json')
console.log('Note: Categories will be inferred from expert content via inferCategory() function')
