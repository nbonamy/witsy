/**
 * AssistantApi - Lean assistant wrapper for HTTP API/CLI use
 *
 * Wraps the base Assistant class with CLI-specific behavior:
 * - Sets system instructions based on workDir access level
 * - Configures and adds CliPlugin for filesystem operations
 */

import Chat from '@models/chat'
import Message from '@models/message'
import { LlmChunk } from 'multi-llm-ts'
import { Configuration } from 'types/config'
import Assistant from '../renderer/services/assistant'
import LlmFactory from '../renderer/services/llms/llm'
import CliPlugin, { WorkDirAccess } from './cli_plugin'
import { generateCliInstructions } from './cli_prompts'

export interface WorkDir {
  path: string
  access: WorkDirAccess
}

export interface ApiPromptOptions {
  engine: string
  model: string
  noMarkdown?: boolean
  abortSignal?: AbortSignal
}

export type ApiChunkCallback = (chunk: LlmChunk) => void

export default class AssistantApi {

  private config: Configuration
  private workDir: WorkDir | null
  private assistant: Assistant
  private llmManager: ReturnType<typeof LlmFactory.manager>
  private chat: Chat

  constructor(config: Configuration, workDir?: WorkDir | null) {
    // Disable artifacts for CLI/API context
    config.llm.additionalInstructions = {
      ...config.llm.additionalInstructions,
      artifacts: false
    }
    this.config = config
    this.workDir = workDir ?? null
    this.llmManager = LlmFactory.manager(config)
    this.assistant = new Assistant(config)
    this.chat = new Chat()
  }

  /**
   * Initialize the chat with engine/model and set up instructions
   */
  initializeChat(engine: string, model: string): void {
    this.chat.setEngineModel(engine, model)
    this.assistant.setChat(this.chat)

    // Set CLI-specific instructions if workDir is configured
    if (this.workDir && this.workDir.access !== 'none') {
      this.chat.instructions = generateCliInstructions(
        this.workDir.path,
        this.workDir.access
      )
    }
  }

  /**
   * Add messages to the chat (for conversation history)
   */
  addMessages(messages: Message[]): void {
    messages.forEach(msg => this.chat.addMessage(msg))
  }

  /**
   * Run a prompt with streaming
   */
  async prompt(
    prompt: string,
    opts: ApiPromptOptions,
    onChunk: ApiChunkCallback
  ): Promise<void> {

    // Initialize LLM
    const llm = this.llmManager.igniteEngine(opts.engine)
    this.assistant.setLlm(llm)

    // Clear existing plugins and add CLI plugin if configured
    llm.clearPlugins()
    if (this.workDir && this.workDir.access !== 'none') {
      const cliPlugin = new CliPlugin({
        workDirPath: this.workDir.path,
        workDirAccess: this.workDir.access
      })
      llm.addPlugin(cliPlugin)
    }

    // Run prompt
    await this.assistant.prompt(prompt, {
      model: opts.model,
      keepLlm: true,
      streaming: true,
      titling: false,
      noMarkdown: opts.noMarkdown,
      abortSignal: opts.abortSignal,
    }, onChunk)
  }

  /**
   * Get the chat instance
   */
  getChat(): Chat {
    return this.chat
  }

  /**
   * Get the last message in the chat
   */
  getLastMessage(): Message | null {
    return this.chat.lastMessage()
  }
}
