
import { Configuration } from '../types/config.d'
import { App } from 'electron'
import { loadSettings } from '../main/config'
import { igniteEngine } from '../services/llm' 
import { LlmResponse } from '../types/llm.d'
import removeMarkdown from 'markdown-to-text'
import LlmEngine from '../services/engine'
import Automator from './automator'
import Message from '../models/message'
import * as window from '../main/window'

export default class PromptAnywhere {

  private llm: LlmEngine
  private cancelled: boolean

  constructor(llm?: LlmEngine) {
    this.llm = llm
    this.cancelled = false
  }

  cancel = async () => {

    // close stuff
    await window.closeWaitingPanel();
    await window.restoreWindows();
    await window.releaseFocus();

    // record
    this.cancelled = true;

  }

  execPrompt = async (app: App, prompt: string): Promise<void> => {

    try {

      // config
      const config: Configuration = loadSettings(app);
      const engine = config.llm.engine;
      const model = config.getActiveModel();

      // open waiting panel
      window.openWaitingPanel();

      // we need an llm
      if (!this.llm) {
        this.llm = igniteEngine(engine, config);
        if (!this.llm) {
          throw new Error(`Invalid LLM engine: ${engine}`)
        }
      }

      // now prompt llm
      console.debug(`Prompting with ${prompt.slice(0, 50)}…`);
      const response = await this.promptLlm(model, prompt);
      const result = removeMarkdown(response.content, {
        stripListLeaders: false,
        listUnicodeChar: ''
      });

      // if cancelled
      if (this.cancelled) {
        console.debug('Discarding LLM output as command was cancelled');
        return
      }

      // done
      await window.closeWaitingPanel();
      await window.restoreWindows();
      await window.releaseFocus();

      // now paste
      console.debug(`Processing LLM output: ${result.slice(0, 50)}…`);

      // we need an automator
      const automator = new Automator();
      await automator.pasteText(result)


    } catch (error) {
      console.error('Error while testing', error);
    }

    // done waiting
    await window.closeWaitingPanel(true);
    await window.restoreWindows();
    await window.releaseFocus();

  }

  private promptLlm = (model: string, prompt: string): Promise<LlmResponse> => {

    // build messages
    const messages: Message[]  = [
      new Message('user', prompt)
    ]

    // now get it
    return this.llm.complete(messages, { model: model })

  }


}