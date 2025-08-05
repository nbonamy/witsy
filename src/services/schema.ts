import { z, ZodType } from 'zod'
import { AgentStepStructuredOutput } from '../types/index'

export const parseSimpleFormatToZod = (structure: any): ZodType => {

  // when we a get type object return its type
  if (typeof structure === 'object' && Object.keys(structure ?? {}).includes('type')) {
    if (structure['type'] !== 'object') {
      return parseSimpleFormatToZod(structure['type'])
    }
  }

  // simple types
  if (typeof structure === 'string') {
    switch (structure) {
      case 'string': return z.string()
      case 'number': return z.number()
      case 'boolean': return z.boolean()
      case 'string[]': return z.array(z.string())
      case 'number[]': return z.array(z.number())
      case 'boolean[]': return z.array(z.boolean())
      default: return z.string()
    }
  } else if (typeof structure === 'number') {
    return z.number()
  } else if (typeof structure === 'boolean') {
    return z.boolean()
  }
  
  // array
  if (Array.isArray(structure)) {
    return z.array(parseSimpleFormatToZod(structure[0]))
  }

  // object
  if (typeof structure === 'object' && structure !== null) {
    
    const zodObject: Record<string, ZodType> = {}
    for (const [key, value] of Object.entries(structure)) {
      zodObject[key] = parseSimpleFormatToZod(value)
    }

    // if formal spec
    if (Object.keys(zodObject).includes('type') && Object.keys(zodObject).includes('properties')) {
      return zodObject['properties']
    }

    // default
    return z.object(zodObject)

  }
  
  // default
  return z.string()
}

export const processJsonSchema = (name: string, jsonSchema?: string): AgentStepStructuredOutput|null => {

  if (!jsonSchema) return null

  let parsedSchema: any
  try {
    parsedSchema = JSON.parse(jsonSchema)
  } catch (e) {
    console.warn('Provided schema is not valid JSON :', e)
    return null
  }

  try {
    return {
      name,
      structure: parseSimpleFormatToZod(parsedSchema)
    }
  } catch (e) {
    console.error('Failed to parse structured output schema:', e)
    return null
  }
}