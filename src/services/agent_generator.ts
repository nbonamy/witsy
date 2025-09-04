import { useTools } from '../composables/useTools'
import LlmFactory from '../llms/llm'
import Agent from '../models/agent'
import Message from '../models/message'
import { Configuration } from '../types/config'
import { i18nInstructions } from './i18n'
import { processJsonSchema } from './schema'

export default class AgentGenerator {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  async generateAgentFromDescription(
    description: string, 
    selectedEngine?: string, 
    selectedModel?: string
  ): Promise<Agent | null> {

    try {

      // Get the best model for generation
      const { engine, model } = await this.getBestModelForGeneration(selectedEngine, selectedModel)
      
      // Get available tools
      const { getToolsForGeneration } = useTools()
      const toolsDescription = await getToolsForGeneration(this.config)
      
      // Build the generation prompt
      const systemPrompt = this.buildSystemPrompt(toolsDescription)
      let userPrompt = this.buildUserPrompt(description)
      
      // Add JSON schema instructions (same pattern as runner.ts)
      const jsonSchema = this.getAgentJsonSchema()
      const instructions = i18nInstructions(this.config, 'instructions.agent.structuredOutput')
      userPrompt += `\n\n${instructions.replace('{jsonSchema}', jsonSchema)}`
      
      // Create messages
      const messages = [
        new Message('system', systemPrompt),
        new Message('user', userPrompt)
      ]

      // Get the LLM and generate
      const llmManager = LlmFactory.manager(this.config)
      const llm = llmManager.igniteEngine(engine)
      const chatModel = llmManager.getChatModel(engine, model)
      
      // Create structured output schema
      const structuredOutput = processJsonSchema('agent', this.getAgentJsonSchema())
      
      const response = await llm.complete(chatModel, messages, {
        tools: false,
        reasoningEffort: 'medium',
        thinkingBudget: 5000,
        reasoning: false,
        structuredOutput: structuredOutput
      })

      // Parse and validate the response
      const agent = this.parseAndValidateResponse(response.content.trim())
      return agent

    } catch (error) {
      console.error('Error generating agent from description:', error)
      return null
    }
  }

  private async getBestModelForGeneration(
    selectedEngine?: string, 
    selectedModel?: string
  ): Promise<{ engine: string, model: string }> {
    
    // If both engine and model are specified, use them
    if (selectedEngine && selectedModel) {
      return { engine: selectedEngine, model: selectedModel }
    }

    // Hard-coded generation models (similar to titling models in llm_utils.ts)
    const generationModels: Record<string, string> = {
      'anthropic': 'claude-3-5-sonnet-20241022',
      'openai': 'gpt-4o',
      'google': 'gemini-2.0-flash-exp',
      'mistralai': 'mistral-large-latest',
      'groq': 'llama-3.3-70b-versatile',
      'cerebras': 'llama-3.3-70b',
      'deepseek': 'deepseek-chat',
      'xai': 'grok-3',
    }

    // Try to use selected engine with best model
    if (selectedEngine) {
      const bestModel = generationModels[selectedEngine]
      if (bestModel && this.config.engines[selectedEngine]?.models?.chat.find(m => m.id === bestModel)) {
        return { engine: selectedEngine, model: bestModel }
      }
      // Fall back to first available model for the selected engine
      const firstModel = this.config.engines[selectedEngine]?.models?.chat?.[0]?.id
      if (firstModel) {
        return { engine: selectedEngine, model: firstModel }
      }
    }

    // Try each engine in order of preference
    for (const [engineName, preferredModel] of Object.entries(generationModels)) {
      if (this.config.engines[engineName]?.models?.chat?.find(m => m.id === preferredModel)) {
        return { engine: engineName, model: preferredModel }
      }
    }

    // Fallback to current configured engine/model
    const fallbackEngine = this.config.llm.engine
    const fallbackModel = this.config.engines[fallbackEngine]?.models?.chat?.[0]?.id || 'default'
    return {
      engine: fallbackEngine,
      model: fallbackModel
    }
  }

  private getAgentJsonSchema(): string {
    return JSON.stringify({
      type: "object",
      properties: {
        name: { type: "string", description: "Descriptive name for the agent" },
        description: { type: "string", description: "Brief description of what the agent does" },
        type: { type: "string", enum: ["runnable"], description: "Agent type - should be 'runnable'" },
        instructions: { type: "string", description: "Detailed instructions for the agent's behavior and personality" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "What this step does" },
              prompt: { type: "string", description: "The prompt template for this step with variables like {{topic}} and {{output.1}}" },
              tools: { type: "array", items: { type: "string" }, description: "Array of tool names to use in this step" },
              agents: { type: "array", items: { type: "string" }, description: "Array of agent names to delegate to" }
            },
            required: ["description", "prompt", "tools", "agents"]
          }
        }
      },
      required: ["name", "description", "type", "instructions", "steps"]
    })
  }

  private buildSystemPrompt(toolsDescription: string): string {
    return `You are an expert AI agent configuration generator. Your task is to analyze a user's description of their desired agent and generate a complete agent configuration.

${toolsDescription}

CRITICAL: Multi-step workflow variables:
- Use {{output.1}} to reference the output from step 1
- Use {{output.2}} to reference the output from step 2
- And so on for subsequent steps
- This is ESSENTIAL for connecting steps in multi-step workflows
- Example: Step 2 prompt could be "Analyze the following data: {{output.1}}"

Important guidelines:
1. Only use tools that are listed in the available tools above
2. Create multiple steps if the task requires different phases or tools
3. Use descriptive prompts with placeholder variables like {{topic}}, {{query}}, {{filename}}
4. For multi-step workflows, ALWAYS use {{output.#}} variables to connect steps
5. Match tools to their appropriate use cases
6. Make the agent instructions detailed and specific
7. Choose meaningful step descriptions
8. The agent type should be "runnable"
9. When creating multi-step workflows, ensure later steps reference earlier steps using {{output.#}}

Examples of good multi-step prompts:
- Step 1: "Search for information about {{topic}}"
- Step 2: "Summarize the following search results: {{output.1}}" 
- Step 3: "Save the summary to file {{filename}}: {{output.2}}"`
  }

  private buildUserPrompt(description: string): string {
    return `Generate an agent configuration for the following description:

${description}

Remember to:
- Select appropriate tools based on the agent's needs
- Create logical workflow steps
- Use clear, actionable prompts
- Include relevant prompt variables
- Make the agent professional and helpful

Return the complete JSON configuration.`
  }

  private parseAndValidateResponse(response: string): Agent | null {
    try {
      let agentConfig: any

      // With structured output, the response might already be parsed
      try {
        agentConfig = JSON.parse(response)
      } catch {
        // If JSON.parse fails, the response might already be an object (structured output)
        // or it might be a string that needs cleaning
        if (typeof response === 'object') {
          agentConfig = response
        } else {
          // Clean up the response (remove potential markdown formatting)
          let cleanResponse = response
          if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '')
          } else if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '')
          }
          agentConfig = JSON.parse(cleanResponse)
        }
      }

      // Validate required fields
      if (!agentConfig.name || !agentConfig.description) {
        throw new Error('Missing required fields: name or description')
      }

      if (!agentConfig.steps || !Array.isArray(agentConfig.steps) || agentConfig.steps.length === 0) {
        throw new Error('Agent must have at least one step')
      }

      // Create agent from the parsed config
      const agent = Agent.fromJson({
        name: agentConfig.name,
        description: agentConfig.description,
        type: agentConfig.type || 'runnable',
        instructions: agentConfig.instructions || '',
        steps: agentConfig.steps.map((step: any) => ({
          description: step.description || '',
          prompt: step.prompt || '',
          tools: step.tools || [],
          agents: step.agents || [],
          docrepo: step.docrepo || undefined,
          jsonSchema: step.jsonSchema || undefined,
          structuredOutput: step.structuredOutput || undefined
        }))
      })

      return agent

    } catch (error) {
      console.error('Error parsing agent generation response:', error)
      console.error('Raw response:', response)
      return null
    }
  }
}