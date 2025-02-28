
import * as llm from 'multi-llm-ts'
import fs from 'fs'

const DEFAULT_ENGINE = 'anthropic'
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219'

const system = `You are an assistant helping to add i18n to a project.
The project is an electron app written in TypesSrcipt and Vue 3.
The project uses vue-i18n for internationalization.
The project uses bootstrap-icons-vue for icons.
You will given a file to localize and your objective is to extract all the hardcoded strings and replace them with i18n keys.
If you do not detect any hard-coded string, skip the file without modifying it.
If you believe the file has already been processed, skip the file without modifying it.
You need to preserve the original files formatting including empty lines, comments... Make sure you don't use \\n as a character but use proper new lines.
Do not translate console.log messages or messages of thrown errrors.
In .vue files, you will add the following block right after <script setup lang="ts"> and then you will use the t function both in the template and in the script code:
import { useI18n } from 'vue-i18n' 
const { t } = useI18n()

In .ts files you will import i18n from 'src/i18n' using a relative path and then use i18n.t to use translations.
The available locales are en and fr: locales/en.json and locales/fr.json.
In those locale files you will use a "common" section for generic messages such as "Save" and "Cancel".
Otherwise you will build a hierarchy of sections and keys that make sense for the project. Do not use folder names for that hierarchy.
Some concepts of the project are: Experts, Commands, PromptAnywhere, and DocRepo.
You can use the provided tools to read and write the files: original vue file and the locales files.
Don't say anything about what you are doing. Just use the tools.`

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

(async () => {
  
  llm.logger.set(() => { /* empty */ })

  const engine = llm.igniteEngine(process.env.ENGINE || DEFAULT_ENGINE, { apiKey: process.env.API_KEY })
  engine.addPlugin(new ReadFilePlugin())
  engine.addPlugin(new WriteFilePlugin())

  const directories = [
    // 'src/components',
    // 'src/composables',
    // 'src/plugins',
    // 'src/scratchpad',
    'src/screens',
    // 'src/services',
    'src/settings',
    // 'src/voice',
  ]

  for (const directory of directories) {

    const files = fs.readdirSync(directory)
    for (const filename of files) {

      const filepath = `${directory}/${filename}`
      console.log(`\n***Localizing file ${filepath}\n`)

      const stream = engine.generate(process.env.MODEL || DEFAULT_MODEL, [
        new llm.Message('system', system),
        new llm.Message('user', `Localize file ${filepath}`),
      ], { usage: true })

      let inputTokens = 0
      let outputTokens = 0

      for await (const msg of stream) {
        if (msg.type === 'content') {
          if (msg.text.length) {
            console.log(msg.text)
          }
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
