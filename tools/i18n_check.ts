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
const TOOLS_DIR = 'tools'
const SNAPSHOT_FILE = path.join(TOOLS_DIR, 'en_snapshot.json')
const I18N_KEY_PATTERN_T = /[ "](?:\$t|t)\(['"]([^'"]+)['"]/g
const I18N_KEY_PATTERN_I = /i18nInstructions\((?:[^,]+),\s*['"]([^'"]+)['"]/g
const DEFAULT_ENGINE = 'openai'
const DEFAULT_MODEL = 'gpt-4.1-mini'

// Keys that should be excluded from unused key detection (programmatically referenced)
const EXCLUDE_FROM_UNUSED_PATTERNS = [
  /^agent\.forge\.list\..*$/,
  /^agent\.status\..*$/,
  /^agent\.trigger\..*$/,
  /^chat\.role\..*$/,
  /^commands\.commands\..*$/,
  /^common\.language\.[a-z]{2}-[A-Z]{2}$/,
  /^computerUse\.action\..*$/,
  /^experts\.categories\..*$/,
  /^experts\.experts\..*$/,
  /^settings\.plugins\.[^.]+\.title$/,
  /^tray\.notification\..*$/,
]

// Key prefixes to exclude from processing (extraction and en.json addition)
const EXCLUDE_KEY_PREFIXES = [
  'common.language.',
  'settings.load.error.'
]

// Pattern to detect linked translations
const LINKED_TRANSLATION_REGEX = /^@:\{'.*'\}$/

// Parse command line arguments
const args = process.argv.slice(2)
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

// Function to load English snapshot
function loadEnglishSnapshot(): Record<string, string> {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const snapshotContent = fs.readFileSync(SNAPSHOT_FILE, 'utf8')
      return JSON.parse(snapshotContent)
    }
    return {}
  } catch {
    console.warn(`Warning: Could not load English snapshot from ${SNAPSHOT_FILE}`)
    return {}
  }
}

// Function to update English snapshot
function updateEnglishSnapshot(enData: Record<string, string>): void {
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(enData, null, 2) + '\n', 'utf8')
    console.log(`\n✅ Updated English snapshot: ${SNAPSHOT_FILE}\n`)
  } catch (error) {
    console.error('Error saving English snapshot:', error)
  }
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

// Function to get candidates for deletion (unused keys)
async function getCandidatesForDeletion(): Promise<Set<string>> {
  const allUnusedKeys = new Set<string>()
  
  try {
    // Get all locale files
    const localeFiles = fs.readdirSync(LOCALES_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(LOCALES_DIR, file))

    // First pass: collect all linked references from en.json only
    const referencedKeys = new Set<string>()
    const localeData = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'))
    const flattenData = flatten(localeData)
    const allKeys = Object.keys(flattenData)

    // Find all linked translations in en.json
    for (const key of allKeys) {
      const value = flattenData[key]
      if (typeof value === 'string') {
        const regex = /@:\{'([^}]+)'\}/g
        let match
        while ((match = regex.exec(value)) !== null) {
          const referencedKey = match[1]
          referencedKeys.add(referencedKey)
        }
      }
    }

    // Second pass: process each locale file with knowledge of globally referenced keys
    for (const file of localeFiles) {
      
      const localeData = JSON.parse(fs.readFileSync(file, 'utf8'))
      const flattenData = flatten(localeData)
      const allKeys = Object.keys(flattenData)

      // some keys are not referenced in the code explicitly, so we need to filter them out
      // for instance the id might be built programmatically...
      const unusedKeys = new Set(allKeys.filter(key =>
        !EXCLUDE_FROM_UNUSED_PATTERNS.some(pattern => pattern.test(key))
      ))

      // Remove keys that are globally referenced via linked translations from any locale file
      for (const referencedKey of referencedKeys) {
        if (allKeys.includes(referencedKey)) {
          unusedKeys.delete(referencedKey)
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
    }

    return allUnusedKeys
  } catch (error) {
    console.error('Error checking unused translations:', error)
    process.exit(1)
  }
}

// Function to load locales from disk
function loadLocales(): { [locale: string]: LocaleData } {
  const localeFiles = fs.readdirSync(LOCALES_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(LOCALES_DIR, file))

  if (localeFiles.length === 0) {
    console.error('No locale files found in the locales directory.')
    process.exit(1)
  }

  const locales: { [locale: string]: LocaleData } = {}
  for (const file of localeFiles) {
    const localeName = path.basename(file, '.json')
    locales[localeName] = JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  return locales
}

// Function to extract all i18n keys from source files
function extractKeyUsages(locales: { [locale: string]: LocaleData }): Map<string, KeyUsage> {
  const srcFiles = glob.sync(`${SRC_DIR}/**/*.{ts,vue}`)
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

          if (EXCLUDE_KEY_PREFIXES.some(prefix => key.startsWith(prefix.replace(/\.$/, '')))) {
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

  // Add keys from en.json that aren't found in source files
  const enKeys = flatten(locales.en)
  Object.keys(enKeys).forEach(key => {
    if (!keyUsages.has(key) && !EXCLUDE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
      keyUsages.set(key, { key, files: [] })
    }
  })

  return keyUsages
}

// Function to filter and categorize keys
function categorizeKeys(
  keyUsages: Map<string, KeyUsage>,
  unusedKeys: Set<string>,
  enData: Record<string, string>
): {
  candidateKeys: string[]
  keysNeedingEnglish: string[]
  keysWithChangedEnglish: string[]
} {
  const allKeys = Array.from(keyUsages.keys())

  // Filter out unused keys (candidates for deletion)
  const candidateKeys = allKeys.filter(key => !unusedKeys.has(key))

  // Separate regular translations (for change detection)
  const regularTranslations = candidateKeys.filter(key => {
    const enValue = enData[key]
    return enValue && !LINKED_TRANSLATION_REGEX.test(enValue)
  })

  // Identify keys that need English translations (missing or empty English values)
  const keysNeedingEnglish = candidateKeys.filter(key => {
    const enValue = enData[key]
    return !enValue || enValue.trim() === ''
  })

  // Load English snapshot and compare for changes (only for regular translations, not linked)
  const enSnapshot = loadEnglishSnapshot()
  const keysWithChangedEnglish = regularTranslations.filter(key => {
    const currentValue = enData[key]
    const snapshotValue = enSnapshot[key]
    // Key has changed if snapshot exists and values differ
    return snapshotValue && currentValue !== snapshotValue
  })

  return {
    candidateKeys, // Now includes both linked and regular translations
    keysNeedingEnglish,
    keysWithChangedEnglish
  }
}

// Function to detect missing translations
function detectMissingTranslations(
  locales: { [locale: string]: LocaleData },
  candidateKeys: string[],
  keysWithChangedEnglish: string[]
): MissingTranslations {
  const missingTranslations: MissingTranslations = {}

  Object.keys(locales).forEach(locale => {
    missingTranslations[locale] = []
  })

  // Combine regular candidates with changed English keys for translation checking
  const allTranslationCandidates = new Set([...candidateKeys, ...keysWithChangedEnglish])

  // Check each candidate key against all locales
  for (const key of allTranslationCandidates) {
    for (const locale in locales) {
      if (!keyExists(locales[locale], key)) {
        if (!minimatch(key, 'plugins.*.description') || locale === 'en') {
          missingTranslations[locale].push(key)
        }
      }
      // For changed English keys, mark non-English locales as needing translation
      else if (keysWithChangedEnglish.includes(key) && locale !== 'en') {
        missingTranslations[locale].push(key)
      }
    }
  }

  return missingTranslations
}

// Function to get candidates for translation (now much smaller and focused)
async function getCandidatesForTranslation(unusedKeys: Set<string>): Promise<{
  keyUsages: Map<string, KeyUsage>
  locales: { [locale: string]: LocaleData }
  candidateKeys: string[]
  keysNeedingEnglish: string[]
  keysWithChangedEnglish: string[]
  missingTranslations: MissingTranslations
}> {
  try {
    // Load all locale data once
    const locales = loadLocales()
    
    // Extract key usages from source files
    const keyUsages = extractKeyUsages(locales)
    
    // Get English data for filtering
    const enData = flatten(locales.en)
    
    // Categorize and filter keys
    const { candidateKeys, keysNeedingEnglish, keysWithChangedEnglish } = categorizeKeys(keyUsages, unusedKeys, enData)
    
    // Detect missing translations
    const missingTranslations = detectMissingTranslations(locales, candidateKeys, keysWithChangedEnglish)
    
    // Log results
    console.log(`\n🔍 Found ${candidateKeys.length} translation candidates (excluding ${unusedKeys.size} unused keys and linked translations).`)
    if (keysWithChangedEnglish.length > 0) {
      console.log(`Found ${keysWithChangedEnglish.length} keys with changed English text since last snapshot.`)
    }

    return {
      locales,
      keyUsages,
      candidateKeys,
      keysNeedingEnglish,
      keysWithChangedEnglish,
      missingTranslations
    }

  } catch (error) {
    console.error('Error getting translation candidates:', error)
    process.exit(1)
  }
}

// Function to delete candidates for deletion (in-memory only)
function deleteCandidatesForDeletion(locales: { [locale: string]: LocaleData }, unusedKeys: Set<string>): void {
  if (unusedKeys.size === 0) {
    console.log('\n✅ No unused keys to delete.')
    return
  }

  // Process each locale in memory
  Object.keys(locales).forEach(localeName => {
    const localeData = locales[localeName]
    const flattenData = flatten(localeData)
    const allKeys = Object.keys(flattenData)

    // Find unused keys in this locale
    const fileUnusedKeys = allKeys.filter(key => unusedKeys.has(key))

    if (fileUnusedKeys.length > 0) {
      console.log(`\n🔧 Removing ${fileUnusedKeys.length} unused keys from "${localeName}"...`)

      fileUnusedKeys.forEach(key => {
        removeNestedKey(localeData, key)
        console.log(`  - Removed "${key}"`)
      })
    }
  })

  console.log('\n✅ Removed all unused translation keys.')
}

// Function to translate candidates for translation
async function translateCandidatesForTranslation(
  locales: { [locale: string]: LocaleData },
  missingTranslations: MissingTranslations
): Promise<void> {
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
        // For other languages, check if English value exists
        else if (keyExists(locales.en, key)) {
          const enValue = getNestedValue(locales.en, key);

          // If it's a linked translation, copy it directly (don't translate)
          if (LINKED_TRANSLATION_REGEX.test(enValue)) {
            setNestedValue(locales[locale], key, enValue);
            console.log(`  + Copied linked translation "${key}" = "${enValue}"`);
          }
          // Otherwise, prepare for translation
          else {
            localeTranslationBatches[locale].push({ key, en: enValue });
          }
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
    }
  }

  if (fixesApplied) {
    console.log('\n✅ Fixed all missing translation keys.');
  } else {
    console.log('\n✅ No missing translations to fix.');
  }
}

// Function to report unused keys (candidates for deletion)
async function reportUnusedKeys(unusedKeys: Set<string>): Promise<boolean> {
  if (unusedKeys.size === 0) {
    console.log('\n✅ No unused keys found.')
    return false
  }

  try {
    // Get all locale files
    const localeFiles = fs.readdirSync(LOCALES_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(LOCALES_DIR, file))

    let hasUnusedKeys = false
    const goodLocales: string[] = []
    const badLocales: Array<{name: string, keys: string[]}> = []

    // Load and process each locale file
    for (const file of localeFiles) {
      const localeName = path.basename(file, '.json')
      const localeData = JSON.parse(fs.readFileSync(file, 'utf8'))
      const flattenData = flatten(localeData)
      const allKeys = Object.keys(flattenData)

      // Find unused keys in this locale file
      const fileUnusedKeys = allKeys.filter(key => unusedKeys.has(key))

      if (fileUnusedKeys.length > 0) {
        hasUnusedKeys = true
        badLocales.push({
          name: localeName,
          keys: Array.from(fileUnusedKeys).sort()
        })
      } else {
        goodLocales.push(localeName)
      }
    }

    // Report good locales in one line
    if (goodLocales.length > 0) {
      console.log(`\n✅ No unused keys found in "${goodLocales.join('", "')}"`)
    }

    // Report bad locales individually
    badLocales.forEach(locale => {
      console.log(`\n⚠️ Found ${locale.keys.length} unused keys in "${locale.name}":`)
      locale.keys.forEach(key => {
        console.log(`  - ${key}`)
      })
    })

    if (hasUnusedKeys) {
      console.log('\n⚠️ Some translations are unused. Use --fix to automatically remove them.')
    }

    return hasUnusedKeys
  } catch (error) {
    console.error('Error reporting unused translations:', error)
    process.exit(1)
  }
}

// Function to report missing English translations
async function reportMissingEnglishTranslations(
  keyUsages: Map<string, KeyUsage>,
  keysNeedingEnglish: string[]
): Promise<boolean> {
  if (keysNeedingEnglish.length === 0) {
    console.log('\n✅ All keys have English translations.')
    return false
  }

  console.log(`\n📛 Found ${keysNeedingEnglish.length} keys missing English translations:`)
  keysNeedingEnglish.forEach(key => {
    const usage = keyUsages.get(key)!
    console.log(`  - ${key}`)
    usage.files.forEach(({ filename, line }) => {
      console.log(`    ↳ ${filename}:${line}`)
    })
  })

  console.log('\n❌ Some keys are missing English translations. Please add English values for these keys.')
  return true
}

// Function to report changed English translations
async function reportChangedEnglishTranslations(
  keyUsages: Map<string, KeyUsage>,
  keysWithChangedEnglish: string[],
  locales: { [locale: string]: LocaleData }
): Promise<boolean> {
  if (keysWithChangedEnglish.length === 0) {
    console.log('\n✅ No English translations have changed since last snapshot.')
    return false
  }

  console.log(`\n🔄 Found ${keysWithChangedEnglish.length} keys with changed English translations:`)
  const enData = flatten(locales.en)
  const enSnapshot = loadEnglishSnapshot()
  
  keysWithChangedEnglish.forEach(key => {
    const usage = keyUsages.get(key)!
    const currentValue = enData[key]
    const snapshotValue = enSnapshot[key]
    console.log(`  - ${key}`)
    console.log(`    Old: "${snapshotValue}"`)
    console.log(`    New: "${currentValue}"`)
    usage.files.forEach(({ filename, line }) => {
      console.log(`    ↳ ${filename}:${line}`)
    })
  })

  console.log('\n⚠️ English translations have changed. Other language translations may need updates. Use --fix to retranslate and update snapshot.')
  return true
}

// Function to report missing translations (candidates for translation)
async function reportMissingTranslations(
  keyUsages: Map<string, KeyUsage>,
  missingTranslations: MissingTranslations
): Promise<boolean> {
  let hasMissingTranslations = false
  const goodLocales: string[] = []
  const badLocales: Array<{name: string, keys: string[]}> = []

  Object.entries(missingTranslations).forEach(([locale, keys]) => {
    if (keys.length > 0) {
      hasMissingTranslations = true
      badLocales.push({name: locale, keys})
    } else {
      goodLocales.push(locale)
    }
  })

  // Report good locales in one line
  if (goodLocales.length > 0) {
    if (goodLocales.length === Object.keys(missingTranslations).length) {
      console.log(`\n✅ All translations complete in all locales`)
    } else {
      console.log(`\n✅ All translations complete in "${goodLocales.join('", "')}"`)
    }
  }

  // Report bad locales individually
  badLocales.forEach(locale => {
    console.log(`\n📛 Locale "${locale.name}" is missing ${locale.keys.length} translation keys:`)
    locale.keys.forEach(key => {
      const usage = keyUsages.get(key)!
      console.log(`  - ${key}`)
      usage.files.forEach(({ filename, line }) => {
        console.log(`    ↳ ${filename}:${line}`)
      })
    })
  })

  if (hasMissingTranslations) {
    console.log('\n❌ Some translations are missing. Please update your locale files or use --fix to automatically add them.')
    return true
  } else {
    console.log('\n✅ All i18n keys are properly translated in all locale files!')
    return false
  }
}

// Function to get wrong linked translations data
function getWrongLinkedTranslations(locales: { [locale: string]: LocaleData }): {
  enData: Record<string, string>
  linkedKeys: string[]
  wrongLinkedTranslations: Array<{locale: string, keys: string[]}>
} {
  const enData = flatten(locales.en)

  // get linked translations
  const linkedKeys: string[] = []
  Object.keys(enData).forEach(key => {
    if (LINKED_TRANSLATION_REGEX.test(enData[key])) {
      linkedKeys.push(key)
    }
  })

  const wrongLinkedTranslations: Array<{locale: string, keys: string[]}> = []

  // Process each locale in memory
  Object.keys(locales).forEach(localeName => {
    if (localeName === 'en') {
      return
    }
    
    const flattenedLocaleData = flatten(locales[localeName])

    const wrongLinkedKeys = linkedKeys.filter(key => {
      const value = flattenedLocaleData[key]
      return value && value !== enData[key]
    })

    if (wrongLinkedKeys.length > 0) {
      wrongLinkedTranslations.push({locale: localeName, keys: wrongLinkedKeys})
    }
  })

  return { enData, linkedKeys, wrongLinkedTranslations }
}

// Function to report wrong linked translations
async function reportWrongLinkedTranslations(wrongLinkedTranslations: Array<{locale: string, keys: string[]}>): Promise<boolean> {
  if (wrongLinkedTranslations.length === 0) {
    console.log('\n✅ No wrong linked translations found in any locale')
    return false
  }

  const goodLocales: string[] = []
  const badLocales: Array<{name: string, keys: string[]}> = []

  // Get all locale files to find good ones
  const localeFiles = fs.readdirSync(LOCALES_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'))
    .filter(name => name !== 'en')

  // Identify good vs bad locales
  localeFiles.forEach(localeName => {
    const found = wrongLinkedTranslations.find(wlt => wlt.locale === localeName)
    if (found) {
      badLocales.push({name: found.locale, keys: found.keys})
    } else {
      goodLocales.push(localeName)
    }
  })

  // Report good locales in one line
  if (goodLocales.length > 0) {
    console.log(`\n✅ No wrong linked translations found in "${goodLocales.join('", "')}"`)
  }

  // Report bad locales individually
  badLocales.forEach(locale => {
    console.log(`\n⚠️ Found ${locale.keys.length} wrong linked translations in "${locale.name}":`)
    locale.keys.forEach(key => console.log(`  - ${key}`))
  })

  return badLocales.length > 0
}

// Function to fix wrong linked translations (in-memory only)
function fixWrongLinkedTranslations(
  locales: { [locale: string]: LocaleData },
  enData: Record<string, string>,
  wrongLinkedTranslations: Array<{locale: string, keys: string[]}>
): void {
  if (wrongLinkedTranslations.length === 0) {
    console.log('\n✅ No wrong linked translations to fix.')
    return
  }

  for (const wlt of wrongLinkedTranslations) {
    console.log(`\n🔧 Fixing ${wlt.keys.length} wrong linked translations in "${wlt.locale}"...`)
    
    const localeData = locales[wlt.locale]
    
    wlt.keys.forEach(key => {
      setNestedValue(localeData, key, enData[key])
      console.log(`  - Fixed "${key}" with "${enData[key]}"`)
    })
  }

  console.log('\n✅ Fixed all wrong linked translations.')
}

// Function to save all locale files
function saveLocaleFiles(locales: { [locale: string]: LocaleData }): void {
  Object.keys(locales).forEach(localeName => {
    const filePath = path.join(LOCALES_DIR, `${localeName}.json`)
    fs.writeFileSync(
      filePath,
      JSON.stringify(locales[localeName], null, 2) + '\n',
      'utf8'
    )
  })
}

// Main execution function
export async function i18n_check(shouldFix: boolean = args.includes('--fix')) {
  
  // Step 1: Identify candidates for deletion (unused keys)
  const candidatesForDeletion = shouldDelete ? await getCandidatesForDeletion() : new Set<string>()
  
  // Step 2: Load all locales once and identify candidates for translation
  const { locales, keyUsages, keysNeedingEnglish, keysWithChangedEnglish, missingTranslations } = await getCandidatesForTranslation(candidatesForDeletion)
  
  // Step 3: Get wrong linked translations data
  const { enData, wrongLinkedTranslations } = getWrongLinkedTranslations(locales)
  
  if (shouldFix) {
    
    // Step 4: When --fix: delete candidates for deletion first (in-memory)
    if (shouldDelete && candidatesForDeletion.size > 0) {
      deleteCandidatesForDeletion(locales, candidatesForDeletion)
    }
    
    // Step 5: When --fix: fix wrong linked translations (in-memory)
    fixWrongLinkedTranslations(locales, enData, wrongLinkedTranslations)
    
    // Step 6: When --fix: translate candidates for translation in each language (in-memory)
    await translateCandidatesForTranslation(locales, missingTranslations)
    
    // Step 7: Save all modified locale files to disk
    saveLocaleFiles(locales)
    
    // Step 8: When --fix: update English snapshot
    const currentEnData = flatten(locales.en)
    updateEnglishSnapshot(currentEnData)
    
    // Step 9: When --fix: sort files after all operations
    sortLocales()

  } else {

    // Report results when not fixing (in logical order)
    const hasUnusedTranslations = await reportUnusedKeys(candidatesForDeletion)
    const hasWrongLinkedTranslations = await reportWrongLinkedTranslations(wrongLinkedTranslations)
    const hasMissingEnglishTranslations = await reportMissingEnglishTranslations(keyUsages, keysNeedingEnglish)
    const hasChangedEnglishTranslations = await reportChangedEnglishTranslations(keyUsages, keysWithChangedEnglish, locales)
    const hasMissingTranslations = await reportMissingTranslations(keyUsages, missingTranslations)
    
    if (hasMissingTranslations || hasUnusedTranslations || hasMissingEnglishTranslations || hasChangedEnglishTranslations || hasWrongLinkedTranslations) {
      process.exit(1)
    }
  }

}

// Only run main function if this file is executed directly (not imported for testing)
if (require.main === module) {
  i18n_check().catch(console.error)
}
