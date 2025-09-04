import { LlmStructuredOutput } from 'multi-llm-ts'
import { z } from 'zod'
import { useTools } from '../composables/useTools'
import LlmFactory from '../llms/llm'
import Agent from '../models/agent'
import Message from '../models/message'
import { Configuration } from '../types/config'
import { i18nInstructions } from './i18n'
import LlmUtils from './llm_utils'

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
      const llmUtils = new LlmUtils(this.config)
      const { engine, model } = llmUtils.getEngineModelForTask('complex', selectedEngine, selectedModel)
      
      // Get available tools
      const { getToolsForGeneration } = useTools()
      const toolsDescription = await getToolsForGeneration(this.config)
      
      // Build the generation prompt
      const systemPrompt = this.buildSystemPrompt(toolsDescription)
      let userPrompt = this.buildUserPrompt(description)
      
      // Add JSON schema instructions (same pattern as runner.ts)
      const structuredOutput = this.getAgentZodSchema()
      const instructions = i18nInstructions(this.config, 'instructions.agent.structuredOutput')
      userPrompt += `\n\n${instructions.replace('{jsonSchema}', this.getAgentJsonSchema())}`
      
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
      
      const response = await llm.complete(chatModel, messages, {
        tools: false,
        reasoningEffort: 'medium',
        thinkingBudget: 5000,
        reasoning: false,
        structuredOutput: structuredOutput
      })

      // Parse and validate the response
      const contentToProcess = typeof response.content === 'string' ? response.content.trim() : response.content
      const agent = this.parseAndValidateResponse(contentToProcess)
      return agent

    } catch (error) {
      console.error('Error generating agent from description:', error)
      return null
    }
  }

  private getAgentZodSchema = (): LlmStructuredOutput => {
    return {
      name: 'agent',
      structure: z.object({
        name: z.string().min(1).max(100).describe("Descriptive name for the agent"),
        description: z.string().min(1).max(500).describe("Brief description of what the agent does"),
        type: z.enum(["runnable"]).describe("Agent type - should be 'runnable'"),
        instructions: z.string().min(1).max(2000).describe("Detailed instructions for the agent's behavior and personality"),
        schedule: z.string().describe("Optional crontab-style schedule (e.g., '0 9 * * 1' for Mondays at 9AM). Only include if user requests scheduling."),
        steps: z.array(z.object({
          description: z.string().min(1).max(200).describe("What this step does"),
          prompt: z.string().min(1).max(1000).describe("The prompt template for this step with variables like {{output.1}}"),
          tools: z.array(z.string().min(1)).max(20).describe("Array of tool names to use in this step"),
          agents: z.array(z.string().min(1)).max(5).describe("Array of agent names to delegate to")
        })).min(1).max(10).describe("Array of workflow steps")
      })
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
        schedule: { type: "string", description: "Optional crontab-style schedule (e.g., '0 9 * * 1' for Mondays at 9AM). Only include if user requests scheduling." },
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

INITIAL PROMPT: If possible create fully autonomous agents that can run without user intervention.
If the user request explicitely mentions something that would require a user input then use a prompt placeholder such as {{topic:The topic to research}}
For instance if the user request is "Summarize daily news about a topic of my choice" then the step 1 prompt would be "Search latest information about {{topic:The topic to research}}"
If the user description is explicit enough then do not use placeholders in step 1 prompt.
Never use placeholders in subsequent prompt steps!

WORKFLOW: Multi-step workflow variables:
- Use {{output.1}} to reference the output from step 1
- Use {{output.2}} to reference the output from step 2
- And so on for subsequent steps
- This is ESSENTIAL for connecting steps in multi-step workflows
- A step prompt cannot just be "Analyze search results and extract key insights". It needs to includes a {{output.#}} variable 
- Example: Step 2 prompt could be "Analyze the following data: {{output.1}}"

SCHEDULING: If the user mentions scheduling, timing, or recurring tasks:
- Generate a crontab-style schedule in the "schedule" field
- Only include schedule if explicitly requested by the user
- Do not mention scheduling in the agent goal. Scheduling is unrelated to the agent goal

Important guidelines:
1. Only use tools that are listed in the available tools below
2. Create multiple steps if the task requires different phases or tools
3. Use descriptive prompts with placeholder variables like {{topic}}, {{query}}, {{filename}}
4. For multi-step workflows, ALWAYS use {{output.#}} variables to connect steps
5. Match tools to their appropriate use cases
6. Make the agent instructions detailed and specific. This will be used as a system prompt to the model so it needs to be effective.
7. Choose meaningful step descriptions
8. The agent type should be "runnable"
9. Include a schedule only if the user explicitly requests scheduling or timing

Examples of good multi-step prompts:
- Step 1: "Search for information about {{topic}}"
- Step 2: "Summarize the following search results: {{output.1}}" 
- Step 3: "Save the summary to file {{filename}}: {{output.2}}"

${toolsDescription}

`
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
        schedule: agentConfig.schedule || null,
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