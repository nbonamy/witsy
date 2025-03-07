#!/usr/bin/env npx ts-node

import * as llm from 'multi-llm-ts'
import fs from 'fs'

const DEFAULT_ENGINE = 'anthropic'
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219'

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log(`
Usage: ./tools/i18n_auto.ts <language-code> <language-name>

  language-code: Two-letter ISO code for the target language (e.g., es, de, ja)
  language-name: Full name of the language in English (e.g., Spanish, German, Japanese)

Example: ./tools/i18n_auto.ts es Spanish
`);
  process.exit(1);
}

const langCode = args[0];
const langName = args[1];

console.log(`Translating to ${langName} (${langCode})...`);

const system = `You are an assistant helping to translate software strings across languages.
You are given a list of strings to translate described as a JSON object containing:
- A key that is unique to the string
- The original string in English that needs to be translated
- The translated string in French to use as an example

You will reply with a JSON object containing:
- The key of the string
- The translated string in ${langName}

Only include the JSON payload in your response no additional text.

Example response:

[
  { "key": "greeting",  "translation": "Hello in ${langName}" },
  { "key": "farewell",  "translation": "Goodbye in ${langName}" }
]
`;


(async () => {
  
  llm.logger.set(() => { /* empty */ })

  const engine = llm.igniteEngine(process.env.ENGINE || DEFAULT_ENGINE, { apiKey: process.env.API_KEY })

  const en = JSON.parse(await fs.promises.readFile('locales/en.json', 'utf8'))
  const fr = JSON.parse(await fs.promises.readFile('locales/fr.json', 'utf8'))

  const translations: Record<string, any> = {}
  const targetFile = `locales/${langCode}.json`;
  
  if (await fs.existsSync(targetFile)) {
    Object.assign(translations, JSON.parse(await fs.promises.readFile(targetFile, 'utf8')))
    console.log(`Found existing translations for ${langName} in ${targetFile}`)
  } else {
    console.log(`Creating new translation file for ${langName} (${langCode})`)
  }

  const firstLevelKeys = Object.keys(en)

  for (const key of firstLevelKeys) {

    if (translations[key]) {
      console.log(`Skipping ${key} (already translated)`)
      continue
    }

    const flatten = (obj: Record<string, any>, prefix: string = '') => {
      if (!obj) {
        return {}
      }
      return Object.keys(obj).reduce((acc, k: string) => {
        const pre = prefix.length ? (prefix + '.') : ''
        if (typeof obj[k] === 'string') {
          acc[pre + k] = obj[k]
        } else if (typeof obj[k] === 'object') {
          Object.assign(acc, flatten(obj[k], pre + k))
        }
        return acc
      }, {} as Record<string, any>)
    }

    const enFlat = flatten(en[key])
    const frFlat = flatten(fr[key])

    const entries: any[] = []
    for (const k in enFlat) {
      if (!frFlat[k]) {
        continue
      }
      entries.push({
        key: k,
        en: enFlat[k],
        fr: frFlat[k]
      })
    }

    if (entries.length === 0) {
      console.log(`No strings to translate in ${key}`)
      continue
    }

    console.log(`Translating ${entries.length} strings in ${key}...`)
    
    const result = await engine.complete(process.env.MODEL || DEFAULT_MODEL, [
      new llm.Message('system', system),
      new llm.Message('user', JSON.stringify(entries)),
    ])

    try {
      
      const parsedResult = JSON.parse(result.content!)
      
      translations[key] = {}
      for (const entry of parsedResult) {
        const keys = entry.key.split('.')
        let current = translations[key]
        while (keys.length > 1) {
          const k = keys.shift()!
          if (!current[k]) {
            current[k] = {}
          }
          current = current[k]
        }
        current[keys[0]] = entry.translation
      }

      await fs.promises.writeFile(targetFile, JSON.stringify(translations, null, 2))
      //console.log(`Updated ${targetFile} with new translations for ${key}`)

    } catch (error) {
      console.error(`Failed to parse result for ${key}:`, error)
      console.error('Raw response:', result.content)
    }
  }

  console.log(`\nDONE! Successfully translated to ${langName} (${langCode})`)
  process.exit(0)

})()
