#!/usr/bin/env npx ts-node

import fs from 'fs'
import path from 'path'
import glob from 'glob'

// Configuration
const SRC_DIR = 'src'
const LOCALES_DIR = 'locales'
const I18N_KEY_PATTERN_T = /[ "](?:\$t|t)\(['"]([^'"]+)['"]/g
const I18N_KEY_PATTERN_I = /i18nInstructions\((?:[^,]+),\s*['"]([^'"]+)['"]/g

// Helper types
interface LocaleData {
  [key: string]: any
}

interface MissingTranslations {
  [locale: string]: string[]
}

interface KeyUsage {
  key: string;
  files: Array<{
    filename: string;
    line: number;
  }>;
}

// Main function
async function checkMissingTranslations() {
  try {
    // Get all locale files
    const localeFiles = fs.readdirSync(LOCALES_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(LOCALES_DIR, file))
    
    if (localeFiles.length === 0) {
      console.error('No locale files found in the locales directory.')
      process.exit(1)
    }

    // Load locale data
    const locales: { [locale: string]: LocaleData } = {}
    for (const file of localeFiles) {
      const localeName = path.basename(file, '.json')
      locales[localeName] = JSON.parse(fs.readFileSync(file, 'utf8'))
    }

    // Find all source files
    const srcFiles = glob.sync(`${SRC_DIR}/**/*.{ts,vue}`)
    
    // Extract all i18n keys from source files with their usage locations
    const keyUsages = new Map<string, KeyUsage>()
    
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8')
      const lines = content.split('\n')

      for (const regex of [I18N_KEY_PATTERN_T, I18N_KEY_PATTERN_I]) {
      
        // Need to reset the regex for each file
        regex.lastIndex = 0
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          let match
          
          // Create a new regex for each line to avoid issues with stateful regex
          const lineRegex = new RegExp(regex.source, regex.flags)
          
          while ((match = lineRegex.exec(line)) !== null) {
            
            const key = match[1]
            
            if (!keyUsages.has(key)) {
              keyUsages.set(key, { key, files: [] })
            }
            
            const usage = keyUsages.get(key)!
            usage.files.push({
              filename: file,
              line: i + 1
            })
          }
        }
      }
    
    }
    
    const allKeys = Array.from(keyUsages.keys())
    console.log(`Found ${allKeys.length} unique i18n keys in source files.`)

    // Check for missing translations
    const missingTranslations: MissingTranslations = {}
    
    Object.keys(locales).forEach(locale => {
      missingTranslations[locale] = []
    })

    // Helper function to check if a key exists in a nested object
    function keyExists(obj: any, keyPath: string): boolean {
      const parts = keyPath.split('.')
      let current = obj
      
      for (const part of parts) {
        if (current[part] === undefined) {
          return false
        }
        current = current[part]
      }
      
      return true
    }

    // Check each key against all locales
    for (const key of allKeys) {
      for (const locale in locales) {
        if (!keyExists(locales[locale], key)) {
          if (!key.startsWith('plugins.') || locale === 'en') {
            missingTranslations[locale].push(key)
          }
        }
      }
    }

    // Report results
    let hasMissingTranslations = false
    
    Object.entries(missingTranslations).forEach(([locale, keys]) => {
      if (keys.length > 0) {
        hasMissingTranslations = true
        console.log(`\n📛 Locale "${locale}" is missing ${keys.length} translation keys:`)
        keys.forEach(key => {
          const usage = keyUsages.get(key)!
          console.log(`  - ${key}`)
          usage.files.forEach(({ filename, line }) => {
            console.log(`    ↳ ${filename}:${line}`)
          })
        })
      } else {
        console.log(`\n✅ Locale "${locale}" has all translations.`)
      }
    })

    if (hasMissingTranslations) {
      console.log('\n❌ Some translations are missing. Please update your locale files.')
      process.exit(1)
    } else {
      console.log('\n✅ All i18n keys are properly translated in all locale files!')
    }

  } catch (error) {
    console.error('Error checking i18n keys:', error)
    process.exit(1)
  }
}


async function checkUnusedTranslations() {
  try {
    
    // Get all locale files
    const localeFiles = fs.readdirSync(LOCALES_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(LOCALES_DIR, file))

    // Collect all keys from locale files
    function getAllKeys(obj: any, prefix = ''): string[] {
      return Object.entries(obj).flatMap(([key, value]) => {
        const newKey = prefix ? `${prefix}.${key}` : key
        return typeof value === 'object'
          ? getAllKeys(value, newKey)
          : [newKey]
      })
    }

    // Load and process each locale file
    for (const file of localeFiles) {
      
      const localeName = path.basename(file, '.json')
      const localeData = JSON.parse(fs.readFileSync(file, 'utf8'))
      const allKeys = getAllKeys(localeData)

      // Find all source files
      const srcFiles = glob.sync(`${SRC_DIR}/**/*.{ts,vue}`)
      const unusedKeys = new Set(allKeys.filter(key =>
        !key.match(/^settings\.plugins\.[^.]+\.title$/) &&
        !key.match(/^common\.language\.[a-z]{2}-[A-Z]{2}$/) &&
        !key.match(/^commands\.commands\..*$/) &&
        !key.match(/^experts\.experts\..*$/)
      ))

      // Check each source file for key usage
      for (const srcFile of srcFiles) {
        const content = fs.readFileSync(srcFile, 'utf8')
        allKeys.forEach(key => {
          if (content.includes(key)) {
            unusedKeys.delete(key)
          }
        })
      }

      // Report results
      if (unusedKeys.size > 0) {
        console.log(`\n⚠️ Found ${unusedKeys.size} unused keys in "${localeName}":`)
        Array.from(unusedKeys).sort().forEach(key => {
          console.log(`  - ${key}`)
        })
      } else {
        console.log(`\n✅ No unused keys found in "${localeName}"`)
      }
    }
    


  } catch (error) {
    console.error('Error checking unused translations:', error)
    process.exit(1)
  }
}

// do it
(async () => {
  await checkMissingTranslations()
  await checkUnusedTranslations()
})()
