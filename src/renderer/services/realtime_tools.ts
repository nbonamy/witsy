/**
 * Adapter layer to convert Witsy plugins to OpenAI Agents SDK tool format
 */

import { tool } from '@openai/agents'
import { z, ZodTypeAny } from 'zod'
import { LlmTool, MultiToolPlugin, PluginExecutionContext, ChatModel, LlmEngine, Plugin } from 'multi-llm-ts'
import { PluginInstance } from './plugins/plugins'

/**
 * Convert JSON Schema to Zod schema
 * This handles the conversion from OpenAI API tool format to OpenAI Agents SDK format
 */
export function jsonSchemaToZod(schema: any): ZodTypeAny {

  // Handle object type
  if (schema.type === 'object') {
    const shape: Record<string, ZodTypeAny> = {}
    const properties = schema.properties || {}
    const required = schema.required || []

    for (const [key, prop] of Object.entries<any>(properties)) {
      let zodType = jsonSchemaToZod(prop)

      // Make optional if not in required array
      if (!required.includes(key)) {
        zodType = zodType.optional()
      }

      shape[key] = zodType
    }

    return z.object(shape)
  }

  // Handle string type
  if (schema.type === 'string') {
    let zodString = z.string()
    if (schema.enum && schema.enum.length > 0) {
      return z.enum(schema.enum as [string, ...string[]])
    }
    if (schema.description) {
      zodString = zodString.describe(schema.description)
    }
    return zodString
  }

  // Handle number type
  if (schema.type === 'number' || schema.type === 'integer') {
    let zodNumber = z.number()
    if (schema.description) {
      zodNumber = zodNumber.describe(schema.description)
    }
    return zodNumber
  }

  // Handle boolean type
  if (schema.type === 'boolean') {
    let zodBoolean = z.boolean()
    if (schema.description) {
      zodBoolean = zodBoolean.describe(schema.description)
    }
    return zodBoolean
  }

  // Handle array type
  if (schema.type === 'array') {
    const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any()
    let zodArray = z.array(itemSchema)
    if (schema.description) {
      zodArray = zodArray.describe(schema.description)
    }
    return zodArray
  }

  // Fallback to any
  return z.any()
}

/**
 * Convert a single OpenAI API format tool to OpenAI Agents SDK format
 */
export function convertToolToAgentsFormat(
  llmTool: LlmTool,
  plugin: PluginInstance,
  model: ChatModel,
  abortSignal?: AbortSignal
) {
  const func = llmTool.function
  const zodSchema = jsonSchemaToZod(func.parameters)

  // Ensure zodSchema is a ZodObject as required by tool()
  const parametersSchema = zodSchema._def.typeName === 'ZodObject'
    ? zodSchema
    : z.object({ data: zodSchema })

  return tool({
    name: func.name,
    description: func.description || '',
    parameters: parametersSchema as any,
    execute: async (input: any) => {
      // Create execution context
      const context: PluginExecutionContext = {
        model: model.id,
        abortSignal
      }

      try {
        // For multi-tool plugins, pass the tool name in parameters
        if (plugin instanceof MultiToolPlugin) {
          const result = await plugin.execute(context, {
            tool: func.name,
            parameters: input
          })
          return result
        } else {
          // For single-tool plugins, pass parameters directly
          const result = await plugin.execute(context, input)
          return result
        }
      } catch (error: any) {
        console.error(`Error executing tool ${func.name}:`, error)
        return { error: error.message || 'Tool execution failed' }
      }
    }
  })
}

/**
 * Build LlmTool from a regular Plugin using its parameters
 */
function pluginToLlmTool(plugin: Plugin): LlmTool {
  return {
    type: 'function',
    function: {
      name: plugin.getName(),
      description: plugin.getDescription(),
      parameters: {
        type: 'object',
        properties: plugin.getParameters().reduce((obj: any, param) => {
          obj[param.name] = {
            type: param.type || 'string',
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {})
          }
          return obj
        }, {}),
        required: plugin.getParameters().filter(p => p.required).map(p => p.name)
      }
    }
  }
}

/**
 * Check if a plugin has getTools method (CustomToolPlugin or MultiToolPlugin)
 */
function hasGetTools(plugin: PluginInstance): plugin is PluginInstance & { getTools(): Promise<LlmTool | LlmTool[]> } {
  return 'getTools' in plugin && typeof (plugin as any).getTools === 'function'
}

/**
 * Build tools from an LLM engine's available plugins
 * Returns array of tools ready for RealtimeAgent
 */
export async function buildRealtimeTools(
  engine: LlmEngine,
  model: ChatModel,
  abortSignal?: AbortSignal
) {
  const tools: ReturnType<typeof tool>[] = []

  // Iterate through engine plugins and convert each to Agent SDK format
  for (const iPlugin of engine.plugins) {
    const plugin = iPlugin as PluginInstance

    // Skip plugins that don't serialize in tools or aren't enabled
    if (!plugin.serializeInTools() || !plugin.isEnabled()) {
      continue
    }

    // For custom/multi-tool plugins, get their tool definitions
    if (hasGetTools(plugin)) {
      const pluginTools = await plugin.getTools()
      const toolsArray = Array.isArray(pluginTools) ? pluginTools : [pluginTools]

      for (const llmTool of toolsArray) {
        const agentTool = convertToolToAgentsFormat(llmTool, plugin, model, abortSignal)
        tools.push(agentTool)
      }
    } else {
      // For regular plugins, build the tool from parameters
      const llmTool = pluginToLlmTool(plugin as Plugin)
      const agentTool = convertToolToAgentsFormat(llmTool, plugin, model, abortSignal)
      tools.push(agentTool)
    }
  }

  return tools
}
