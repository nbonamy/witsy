#!/usr/bin/env npx ts-node

import * as llm from 'multi-llm-ts'
import fs from 'fs'

const DEFAULT_ENGINE = 'openai'
const DEFAULT_MODEL = 'gpt-4o-mini'
const PROCESS_SIZE = 20

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

const engine = llm.igniteEngine(process.env.ENGINE || DEFAULT_ENGINE, { apiKey: process.env.API_KEY })

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

type TranslationEntry = {
  key: string
  en: string
  fr: string
}

const translate = async (entries: TranslationEntry[], tr: Record<string, any>) => {
  
  let result: llm.LlmResponse|undefined = undefined

  try {

    if (entries.length === 0) {
      return
    }
    
    result = await engine.complete(process.env.MODEL || DEFAULT_MODEL, [
      new llm.Message('system', system),
      new llm.Message('user', JSON.stringify(entries)),
    ])

    const parsedResult = JSON.parse(result.content!)
      
    for (const entry of parsedResult) {

      entry.key.split('.').reduce((acc: any, key: string, index: number, arr: string[]) => {
        if (index === arr.length - 1) {
          acc[key] = entry.translation
        } else {
          if (!acc[key]) {
            acc[key] = {}
          }
        }
        return acc[key]
      }, tr)

    }
  
  } catch (e) {
    if (result) {
      console.error('Error parsing translation:', result)
    } else {
      console.error('Error translating:', e)
    }
  }

}

const translateLevel = async (
  root: string,
  en: Record<string, any>,
  fr: Record<string, any>,
  tr: Record<string, any>,
  queue: TranslationEntry[],
): Promise<void> => {

  // get keys
  const keys: string[] = []
  for (const key of Object.keys(en)) {
    if (typeof en[key] === 'string') {
      keys.push(key)
    } else if (fr[key]) {
      if (!tr[key]) {
        tr[key] = {}
      }
      await translateLevel(root === '' ? key : `${root}.${key}`, en[key], fr[key], tr[key], queue)
      continue
    }
  }

  // now remove the ones who are not translated in french or already exist in tr
  for (const key of keys) {

    // if not needed or already translated
    if (tr[key] || !fr[key]) {
      continue
    }

    // add to queue
    queue.push({ key: `${root}.${key}`, en: en[key], fr: fr[key] })

  }

}

(async () => {
  
  llm.logger.set(() => { /* empty */ })

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

  // let's start
  const entries: TranslationEntry[] = [];
  await translateLevel('', en, fr, translations, entries)
  if (entries.length === 0) {
    console.log('No strings to translate!')
    process.exit(0)
  }

  // log
  let remaining = entries.length
  console.log(`Found ${remaining} strings to translate...`)

  // build chunks of PROCESS_SIZE
  const chunks: any[] = []
  while (entries.length > 0) {
    chunks.push(entries.splice(0, PROCESS_SIZE))
  }

  // now process each chunk
  for (const chunk of chunks) {
    remaining -= chunk.length
    console.log(`Translating ${chunk.length} strings. ${remaining} remaining...`)
    await translate(chunk, translations)
    await fs.promises.writeFile(targetFile, JSON.stringify(translations, null, 2))
  }

  // done
  console.log(`\nDONE! Successfully translated to ${langName} (${langCode})`)
  process.exit(0)

})()
