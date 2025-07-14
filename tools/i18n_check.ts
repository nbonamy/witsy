#!/usr/bin/env npx ts-node

import fs from 'fs'
import path from 'path'
import glob from 'glob'
import * as llm from 'multi-llm-ts'
import { sortLocales } from './i18n_sort'
import { minimatch } from 'minimatch'
import dotenv from 'dotenv';
dotenv.config();

// Configuration
const SRC_DIR = 'src'
const LOCALES_DIR = 'locales'
const I18N_KEY_PATTERN_T = /[ "](?:\$t|t)\(['"]([^'"]+)['"]/g
const I18N_KEY_PATTERN_I = /i18nInstructions\((?:[^,]+),\s*['"]([^'"]+)['"]/g
const DEFAULT_ENGINE = 'openai'
const DEFAULT_MODEL = 'gpt-4.1-mini'

// Parse command line arguments
const args = process.argv.slice(2)
const shouldFix = args.includes('--fix')
const shouldDelete = !args.includes('--no-delete')

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

// Helper function to set a nested value in an object
function setNestedValue(obj: any, keyPath: string, value: any) {
  const parts = keyPath.split('.')
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part]
  }

  current[parts[parts.length - 1]] = value
}

// Helper function to get a nested value from an object
function getNestedValue(obj: any, keyPath: string): any {
  const parts = keyPath.split('.')
  let current = obj

  for (const part of parts) {
    if (current[part] === undefined) {
      return undefined
    }
    current = current[part]
  }

  return current
}

// Helper function to check if a key exists in a nested object
function keyExists(obj: any, keyPath: string): boolean {
  return getNestedValue(obj, keyPath) !== undefined
}

// Helper function to remove a key from a nested object
function removeNestedKey(obj: any, keyPath: string) {
  const parts = keyPath.split('.')
  const lastPart = parts.pop()!
  let current = obj

  for (const part of parts) {
    if (current[part] === undefined) {
      return
    }
    current = current[part]
  }

  if (current[lastPart] !== undefined) {
    delete current[lastPart]
  }

  // Clean up empty objects
  for (let i = parts.length - 1; i >= 0; i--) {
    const checkPath = parts.slice(0, i + 1).join('.')
    const objAtPath = getNestedValue(obj, checkPath)
    if (objAtPath && Object.keys(objAtPath).length === 0) {
      removeNestedKey(obj, checkPath)
    } else {
      break
    }
  }
}

// Helper function to flatten a nested object
function flatten(obj: Record<string, any>, prefix: string = ''): Record<string, string> {
  if (!obj) {
    return {}
  }
  return Object.keys(obj).reduce((acc, k: string) => {
    const pre = prefix.length ? (prefix + '.') : ''
    if (typeof obj[k] === 'string') {
      acc[pre + k] = obj[k]
    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
      Object.assign(acc, flatten(obj[k], pre + k))
    }
    return acc
  }, {} as Record<string, string>)
}

// Function for translating text
async function translateText(texts: Array<{key: string, en: string}>, locale: string): Promise<Map<string, string>> {
  const translations = new Map<string, string>();
  
  try {
    // Skip translation if locale is English
    if (locale === 'en') {
      texts.forEach(item => translations.set(item.key, item.en));
      return translations;
    }

    // Skip if we have no items to translate
    if (texts.length === 0) {
      return translations;
    }

    // Engine and model
    const provider = process.env.ENGINE || DEFAULT_ENGINE
    const model = process.env.MODEL || DEFAULT_MODEL

    // We need an api key
    const apiKey = process.env.API_KEY || process.env[`${provider.toUpperCase()}_API_KEY`]
    if (provider !== 'ollama' && !apiKey) {
      throw new Error('API_KEY environment variable is not set')
    }

    // Initialize the LLM engine
    const engine = llm.igniteEngine(provider, { apiKey });
    
    // Get locale name from locale code
    const localeNames: Record<string, string> = {
      fr: 'French',
      es: 'Spanish',
      de: 'German',
      ja: 'Japanese',
      zh: 'Chinese',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ko: 'Korean',
      // Add more as needed
    };
    
    const localeName = localeNames[locale] || locale;
    
    // Create the system prompt
    const system = `You are a translation assistant. Translate the given English strings to ${localeName}.
Only include the JSON payload in your response, no additional text.
Example response:
[
  { "key": "greeting", "translation": "Hello in ${localeName}" },
  { "key": "farewell", "translation": "Goodbye in ${localeName}" }
]`;

    // Send the request to the LLM
    console.log(`Translating ${texts.length} strings to ${localeName}...`);
    const result = await engine.complete(engine.buildModel(model), [
      new llm.Message('system', system),
      new llm.Message('user', JSON.stringify(texts)),
    ]);

    if (result.content) {
      const parsedResult = JSON.parse(result.content);
      parsedResult.forEach((entry: {key: string, translation: string}) => {
        translations.set(entry.key, entry.translation);
      });
    }
    
  } catch (e) {
    console.error('Error translating:', e);
    // Fallback to English for failed translations
    texts.forEach(item => translations.set(item.key, item.en));
  }
  
  return translations;
}

// Main function
async function checkMissingTranslations(unusedKeys: Set<string> = new Set()) {
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

            if (key.startsWith('settings.load.error')) {
              continue
            }

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

    let allKeys = Array.from(keyUsages.keys())

    // add keys from en.json
    const enKeys = flatten(locales.en)
    Object.keys(enKeys).forEach(key => {
      if (!allKeys.includes(key) && !key.startsWith('common.language.') && !key.startsWith('settings.load.error.')) {
        keyUsages.set(key, { key, files: [] })
      }
    })

    allKeys = Array.from(keyUsages.keys())
    
    // Filter out unused keys
    allKeys = allKeys.filter(key => !unusedKeys.has(key))
    
    console.log(`Found ${allKeys.length} unique i18n keys in source files (excluding ${unusedKeys.size} unused keys).`)

    // Check for missing translations
    const missingTranslations: MissingTranslations = {}

    Object.keys(locales).forEach(locale => {
      missingTranslations[locale] = []
    })

    // Check each key against all locales
    for (const key of allKeys) {
      for (const locale in locales) {
        if (!keyExists(locales[locale], key)) {
          if (!minimatch(key, 'plugins.*.description') || locale === 'en') {
            missingTranslations[locale].push(key)
          }
        }
      }
    }

    // Fix missing translations if --fix flag is provided
    if (shouldFix) {
      let fixesApplied = false;

      // Prepare for batch translations
      const localeTranslationBatches: Record<string, Array<{key: string, en: string}>> = {};

      // Initialize empty arrays for each locale
      Object.keys(missingTranslations).forEach(locale => {
        if (missingTranslations[locale].length > 0) {
          localeTranslationBatches[locale] = [];
        }
      });

      // Group keys by locale for translation
      Object.entries(missingTranslations).forEach(([locale, keys]) => {
        if (keys.length > 0) {
          console.log(`\n🔧 Found ${keys.length} missing translation keys in "${locale}"...`);
          
          keys.forEach(key => {
            // For English, use the key itself as the value
            if (locale === 'en') {
              //setNestedValue(locales[locale], key, key);
              console.log(`  ‼️ Skipping missing EN "${key}"`);
            }
            // For other languages, prepare for translation
            else if (keyExists(locales.en, key)) {
              const enValue = getNestedValue(locales.en, key);
              localeTranslationBatches[locale].push({ key, en: enValue });
            }
            else {
              // If no English value, use the key itself
              //setNestedValue(locales[locale], key, key);
              console.log(`  ⏭️ Skipped "${key}" (no English value found)`);
            }
          });

          fixesApplied = true;
        }
      });

      // Process translations for each locale
      for (const [locale, translationItems] of Object.entries(localeTranslationBatches)) {
        if (translationItems.length > 0) {
          console.log(`\n🌐 Translating ${translationItems.length} keys for "${locale}"...`);
          
          const translations = await translateText(translationItems, locale);
          
          // Apply translations
          translations.forEach((translatedText, key) => {
            setNestedValue(locales[locale], key, translatedText);
            console.log(`  + Added "${key}" = "${translatedText}"`);
          });
          
          // Save the updated locale file
          fs.writeFileSync(
            path.join(LOCALES_DIR, `${locale}.json`),
            JSON.stringify(locales[locale], null, 2) + '\n',
            'utf8'
          );
        }
      }

      if (fixesApplied) {
        console.log('\n✅ Fixed all missing translation keys.');
      } else {
        console.log('\n✅ No missing translations to fix.');
      }

      // After fixing, there should be no more missing translations
      return false;
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
      console.log('\n❌ Some translations are missing. Please update your locale files or use --fix to automatically add them.')
      return true
    } else {
      console.log('\n✅ All i18n keys are properly translated in all locale files!')
      return false
    }

  } catch (error) {
    console.error('Error checking i18n keys:', error)
    process.exit(1)
  }
}

// Modify checkUnusedTranslations to return unused keys instead of just a boolean
async function checkUnusedTranslations(): Promise<Set<string>> {
  const allUnusedKeys = new Set<string>()
  
  try {
    // Get all locale files
    const localeFiles = fs.readdirSync(LOCALES_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(LOCALES_DIR, file))

    let hasUnusedKeys = false

    // Load and process each locale file
    for (const file of localeFiles) {
      
      const localeName = path.basename(file, '.json')
      const localeData = JSON.parse(fs.readFileSync(file, 'utf8'))
      const flattenData = flatten(localeData)
      const allKeys = Object.keys(flattenData)

      // some keys are not referenced in the code explicitly, so we need to filter them out
      // for instance the id might be built programmatically...
      const unusedKeys = new Set(allKeys.filter(key =>
        !key.match(/^settings\.plugins\.[^.]+\.title$/) &&
        !key.match(/^common\.language\.[a-z]{2}-[A-Z]{2}$/) &&
        !key.match(/^chat\.role\..*$/) &&
        !key.match(/^computerUse\.action\..*$/) &&
        !key.match(/^commands\.commands\..*$/) &&
        !key.match(/^experts\.experts\..*$/) &&
        !key.match(/^tray\.notification\..*$/) &&
        !key.match(/^agent\.forge\.list\..*$/)
      ))

      // also the translation file itself can reference other keys using "@:{'id'}" syntax
      for (const key of allKeys) {
        const value = flattenData[key]
        const regex = /@:\{'([^}]+)'\}/g
        let match
        while ((match = regex.exec(value)) !== null) {
          const referencedKey = match[1]
          if (allKeys.includes(referencedKey)) {
            unusedKeys.delete(referencedKey)
          }
        }
      }

      // Check each source file for key usage
      const srcFiles = glob.sync(`${SRC_DIR}/**/*.{ts,vue}`)
      for (const srcFile of srcFiles) {
        const content = fs.readFileSync(srcFile, 'utf8')
        allKeys.forEach(key => {
          if (content.includes(key)) {
            unusedKeys.delete(key)
          }
        })
      }

      // Add to global unused keys set
      unusedKeys.forEach(key => allUnusedKeys.add(key))

      // Fix unused keys if --fix flag is provided
      if (shouldFix && unusedKeys.size > 0) {
        console.log(`\n🔧 Removing ${unusedKeys.size} unused keys from "${localeName}"...`)

        const updatedLocaleData = JSON.parse(JSON.stringify(localeData))
        Array.from(unusedKeys).forEach(key => {
          removeNestedKey(updatedLocaleData, key)
          console.log(`  - Removed "${key}"`)
        })

        // Save the updated locale file
        fs.writeFileSync(
          file,
          JSON.stringify(updatedLocaleData, null, 2) + '\n',
          'utf8'
        )
      }
      // Report results
      else if (unusedKeys.size > 0) {
        hasUnusedKeys = true
        console.log(`\n⚠️ Found ${unusedKeys.size} unused keys in "${localeName}":`)
        Array.from(unusedKeys).sort().forEach(key => {
          console.log(`  - ${key}`)
        })
      } else {
        console.log(`\n✅ No unused keys found in "${localeName}"`)
      }
    }

    if (hasUnusedKeys && !shouldFix) {
      console.log('\n⚠️ Some translations are unused. Use --fix to automatically remove them.')
    } else if (shouldFix) {
      console.log('\n✅ Removed all unused translation keys.')
    }

    return allUnusedKeys
  } catch (error) {
    console.error('Error checking unused translations:', error)
    process.exit(1)
  }
}

// Check for wrong linked translations
async function checkWrongLinkedTranslations() {

  // load en locale
  const enLocalePath = path.join(LOCALES_DIR, 'en.json')
  const enLocale = JSON.parse(fs.readFileSync(enLocalePath, 'utf8'))
  const enData = flatten(enLocale)

  // get linked translations
  const linkedKeys: string[] = []
  Object.keys(enData).forEach(key => {
    if (enData[key].includes('@:{')) {
      linkedKeys.push(key)
    }
  })

  // Get all locale files
  const localeFiles = fs.readdirSync(LOCALES_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(LOCALES_DIR, file))

  // Load and process each locale file
  for (const file of localeFiles) {

    const localeName = path.basename(file, '.json')
    if (localeName === 'en') {
      continue
    }
    const localeData = JSON.parse(fs.readFileSync(file, 'utf8'))
    const flattenedLocaleData = flatten(localeData)

    const wrongLinkedKeys = linkedKeys.filter(key => {
      const value = flattenedLocaleData[key]
      return value && value !== enData[key]
    })

    if (wrongLinkedKeys.length > 0) {
      console.log(`\n⚠️ Found ${wrongLinkedKeys.length} wrong linked translations in "${localeName}":`)
      wrongLinkedKeys.forEach(key => console.log(`  - ${key}`))
    } else {
      console.log(`\n✅ No wrong linked translations found in "${localeName}"`)
    }

    // Fix wrong linked translations if --fix flag is provided
    if (shouldFix && wrongLinkedKeys.length > 0) {
      console.log(`\n🔧 Fixing ${wrongLinkedKeys.length} wrong linked translations in "${localeName}"...`)
      const updatedLocaleData = JSON.parse(JSON.stringify(localeData))
      wrongLinkedKeys.forEach(key => {
        setNestedValue(updatedLocaleData, key, enData[key])
        console.log(`  - Fixed "${key}" with "${enData[key]}"`)
      })

      // Save the updated locale file
      fs.writeFileSync(
        file,
        JSON.stringify(updatedLocaleData, null, 2) + '\n',
        'utf8'
      )
    }

  }

}



// do it
(async () => {
  
  // Always check for unused translations to get the list
  const unusedKeys = shouldDelete ? await checkUnusedTranslations() : new Set<string>()
  
  // Check for wrong linked translations
  const hasWrongLinkedTranslations = await checkWrongLinkedTranslations()

  // Then check for missing translations, excluding unused keys
  const hasMissingTranslations = await checkMissingTranslations(unusedKeys)
  
  const hasUnusedTranslations = unusedKeys.size > 0
  if ((hasMissingTranslations || hasUnusedTranslations || hasWrongLinkedTranslations) && !shouldFix) {
    process.exit(1)
  }

  // Sort locales
  if (shouldFix) {
    sortLocales()
  }

})()
