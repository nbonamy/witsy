#!/usr/bin/env npx ts-node

import * as llm from 'multi-llm-ts'
import fs from 'fs'

const DEFAULT_ENGINE = 'deepseek'
const DEFAULT_MODEL = 'deepseek-chat'

const system = `You are an assistant helping to create a user documentation for a AI desktop assistant called Witsy.
Witsy is a cross-platform desktop application allowing them to use GenerativeAI technologies for text, image
and video generation. Speech-to-text and text-to-speech are also supported.
Some concepts of Witsy you will encounter are:
- Commands: allowing users to trigger actions on the text selected in any applications. Actions include translation, summarization, rewriting, and more.
- Experts: a set of custom prompts enabling LLM to act as an expert in a specific domain. Experts include Doctor, Lawyer, Developer, and more.
- Scratchpad: an interactive environment allowing users to incrementally build a document using GenerativeAI technologies.
- Design Studio: a visual environment allowing users to create images and videos using GenerativeAI technologies.
- DocRepo: a document repository allowing users to store and manage their documents and use them to ground the GenerativeAI technologies.

Your goal is to write the user documentation for one screen of the application at a time.
The user documentation should be written in markdown format in English.
It should describe the purpose of the screen, the main features, and how to use them.
The user documentation should be clear, concise, and easy to understand for the end user.
Don't document the source code or any technical details.
Don't use any technical jargon or references to the source code or name of the components.
This is a user documentation, not a developer documentation.

You will be provided the source code of a screen of the application.
The source code will be in Typescript and Vue 3.
You may request to load the source code of imported components if you need to understand how they work.
When loading the source code of an important component, also parse this source and check if it includes other components.
If yes, request to get the source code of these components as Witsy follows an embedded component structure.

For that you will use the ReadFilePlugin tool paying attention to the path: if a screen imports
'../components/MyComponent.vue' you will use the ReadFilePlugin to load './src/components/MyComponent.vue'.

You may also find interesting code in ../composables and ../services.

Use the HTML layout, the various events and methods, and the comments in the source code to understand the purpose of the screen and its features.
For instance 'keyup' and 'keydown' events can be used to understand how the user interacts with the screen.

An important component is Prompt.vue which is used to manage the user input: it is a complex one and probably
deserves a distinct documentation.

You will use the WriteFilePlugin tool to write the user documentation to a file in the following format:
../witsy.wiki/<screen_name>.md

Do not include any comments about what you did to generate the documentation or what you think about the screen. Just output the documentation.

Once the file is written to disk, you're done and can exit the process.
`

class ReadFilePlugin extends llm.Plugin {
  isEnabled() { return true }
  getName() { return 'ReadFilePlugin' }
  getDescription() { return 'Read a file from the filesystem given a path' }
  getRunningDescription(tool: string, args: any): string {
    return `Reading file ${args.path}`
  }
  getParameters() {
    return [
      { name: 'path', type: 'string', description: 'The path to the file to read' }
    ]
  }
  async execute(parameters: any) {
    try {
      return { success: true, content: await fs.promises.readFile(parameters.path, 'utf-8') }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
} 

class WriteFilePlugin extends llm.Plugin {
  isEnabled() { return true }
  getName() { return 'WriteFilePlugin' }
  getDescription() { return 'Write a file to the filesystem given a path and content' }
  getRunningDescription(tool: string, args: any): string {
    return `Writing file ${args.path}`
  }
  getParameters() {
    return [
      { name: 'path', type: 'string', description: 'The path to the file to write' },
      { name: 'content', type: 'string', description: 'The content to write' }
    ]
  } async execute(parameters: any) {
    try {
      await fs.promises.writeFile(parameters.path, parameters.content, 'utf-8')
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
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

(async () => {
  
  llm.logger.set(() => { /* empty */ })

  const engine = llm.igniteEngine(process.env.ENGINE || DEFAULT_ENGINE, { apiKey: process.env.API_KEY })
  engine.addPlugin(new ReadFilePlugin())
  engine.addPlugin(new WriteFilePlugin())

  // load english localization file to help the model understand the context
  const localizationPath = './locales/en.json'
  const localizationContent = fs.readFileSync(localizationPath, 'utf-8')
  const localizationData = JSON.parse(localizationContent)
  const enStrings = flatten(localizationData)

  const directories = [
    'src/screens',
    // 'src/settings',
    // 'src/voice',
  ]

  for (const directory of directories) {

    const files = fs.readdirSync(directory)
    for (const filename of files) {

      const filepath = `${directory}/${filename}`
      const content = fs.readFileSync(filepath, 'utf-8')

      const docPath = `../witsy.wiki/${filename.replace('.vue', '.md')}`;
      if (fs.existsSync(docPath)) {
        console.log(`\n*** Documentation already exists for ${filename}, skipping.\n`);
        continue;
      }
      
      console.log(`\n*** Documenting file ${filepath}\n`)

      const stream = engine.generate(process.env.MODEL || DEFAULT_MODEL, [
        new llm.Message('system', system),
        new llm.Message('user', `Document screen ${filepath} in ${docPath} with content:\n\n${content}\n\nAlso use the localization data to help you understand the context:\n\n${JSON.stringify(enStrings, null, 2)}`),
      
      ], { usage: true })

      let inputTokens = 0
      let outputTokens = 0

      for await (const msg of stream) {
        if (msg.type === 'content') {
          // if (msg.text.length) {
          //   console.log(msg.text)
          // }
        } else if (msg.type === 'tool') {
          if (msg.status) {
            console.log(msg.status)
          }
        } else if (msg.type === 'usage') {
          inputTokens += msg.usage.prompt_tokens
          outputTokens += msg.usage.completion_tokens
        }
      }

      console.log(`\nInput: ${inputTokens}\nOutput: ${outputTokens}\n`)

    }

  }

  console.log('DONE!') 
  process.exit(0)

})()
