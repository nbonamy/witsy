import { test, expect } from 'vitest'
import { extractPromptInputs, replacePromptInputs, getMissingInputs, extractAllWorkflowInputs } from '../../src/services/prompt'

test('extractPromptInputs - simple input without description', () => {
  const prompt = 'Hello {{name}}, how are you?'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(1)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: undefined
  })
})

test('extractPromptInputs - input with description', () => {
  const prompt = 'Hello {{name:The user\'s name}}, how are you?'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(1)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: 'The user\'s name'
  })
})

test('extractPromptInputs - multiple inputs with and without descriptions', () => {
  const prompt = 'Hello {{name:The user\'s name}}, you are {{age}} years old and live in {{city:The user\'s city}}.'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(3)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: 'The user\'s name'
  })
  expect(inputs[1]).toEqual({
    name: 'age',
    description: undefined
  })
  expect(inputs[2]).toEqual({
    name: 'city',
    description: 'The user\'s city'
  })
})

test('extractPromptInputs - duplicate inputs are deduplicated', () => {
  const prompt = 'Hello {{name}}, {{name}} is a great name!'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(1)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: undefined
  })
})

test('extractPromptInputs - handles whitespace around names and descriptions', () => {
  const prompt = 'Hello {{ name : The user\'s name }}, you are {{  age  }} years old.'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(2)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: 'The user\'s name'
  })
  expect(inputs[1]).toEqual({
    name: 'age',
    description: undefined
  })
})

test('extractPromptInputs - empty prompt returns empty array', () => {
  const prompt = ''
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(0)
})

test('extractPromptInputs - no inputs in prompt returns empty array', () => {
  const prompt = 'This is a prompt without any inputs.'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(0)
})

test('extractPromptInputs - malformed inputs are ignored', () => {
  const prompt = 'Hello {name}, how are you? And this is {{valid}}.'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(1)
  expect(inputs[0]).toEqual({
    name: 'valid',
    description: undefined
  })
})

test('extractPromptInputs - input with default value but no description', () => {
  const prompt = 'Hello {{name::John}}, how are you?'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(1)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: undefined,
    defaultValue: 'John'
  })
})

test('extractPromptInputs - input with description and default value', () => {
  const prompt = 'Hello {{name:Your name:John}}, how are you?'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(1)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: 'Your name',
    defaultValue: 'John'
  })
})

test('extractPromptInputs - multiple inputs with various combinations', () => {
  const prompt = 'Hello {{name:Your name:John}}, you are {{age::25}} years old and work as {{job:Your profession}}.'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(3)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: 'Your name',
    defaultValue: 'John'
  })
  expect(inputs[1]).toEqual({
    name: 'age',
    description: undefined,
    defaultValue: '25'
  })
  expect(inputs[2]).toEqual({
    name: 'job',
    description: 'Your profession',
    defaultValue: undefined
  })
})

test('extractPromptInputs - handles whitespace in default values', () => {
  const prompt = 'Hello {{ name : Your name : John Doe }}, you work at {{  company  ::  Acme Corp  }}.'
  const inputs = extractPromptInputs(prompt)
  
  expect(inputs).toHaveLength(2)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: 'Your name',
    defaultValue: 'John Doe'
  })
  expect(inputs[1]).toEqual({
    name: 'company',
    description: undefined,
    defaultValue: 'Acme Corp'
  })
})

// test('extractPromptInputs - nested braces are handled correctly', () => {
//   const prompt = 'Use {{template:A template with {nested} braces}} here.'
//   const inputs = extractPromptInputs(prompt)
  
//   expect(inputs).toHaveLength(1)
//   expect(inputs[0]).toEqual({
//     name: 'template',
//     description: 'A template with {nested'
//   })
// })

test('replacePromptInputs - simple replacement', () => {
  const prompt = 'Hello {{name}}, how are you?'
  const inputs = { name: 'John' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello John, how are you?')
})

test('replacePromptInputs - multiple replacements', () => {
  const prompt = 'Hello {{name}}, you are {{age}} years old.'
  const inputs = { name: 'John', age: '25' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello John, you are 25 years old.')
})

test('replacePromptInputs - replacement with description ignores description', () => {
  const prompt = 'Hello {{name:The user\'s name}}, how are you?'
  const inputs = { name: 'John' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello John, how are you?')
})

test('replacePromptInputs - handles whitespace in input definitions', () => {
  const prompt = 'Hello {{ name : description }}, you are {{  age  }} years old.'
  const inputs = { name: 'John', age: '25' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello John, you are 25 years old.')
})

test('replacePromptInputs - duplicate inputs are all replaced', () => {
  const prompt = 'Hello {{name}}, {{name}} is a great name!'
  const inputs = { name: 'John' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello John, John is a great name!')
})

test('replacePromptInputs - missing inputs are left unchanged', () => {
  const prompt = 'Hello {{name}}, you are {{age}} years old.'
  const inputs = { name: 'John' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello John, you are {{age}} years old.')
})

test('replacePromptInputs - empty inputs object leaves prompt unchanged', () => {
  const prompt = 'Hello {{name}}, you are {{age}} years old.'
  const inputs = {}
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello {{name}}, you are {{age}} years old.')
})

test('replacePromptInputs - no inputs in prompt returns original', () => {
  const prompt = 'This is a prompt without any inputs.'
  const inputs = { name: 'John' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('This is a prompt without any inputs.')
})

test('replacePromptInputs - special characters in replacement values', () => {
  const prompt = 'Hello {{name}}, your email is {{email}}.'
  const inputs = { name: 'John', email: 'john@example.com' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello John, your email is john@example.com.')
})

test('replacePromptInputs - replacement with default values', () => {
  const prompt = 'Hello {{name::John}}, you are {{age:Your age:25}} years old.'
  const inputs = { name: 'Alice', age: '30' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello Alice, you are 30 years old.')
})

test('replacePromptInputs - missing inputs with default values are left unchanged', () => {
  const prompt = 'Hello {{name::John}}, you are {{age:Your age:25}} years old.'
  const inputs = { name: 'Alice' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello Alice, you are {{age:Your age:25}} years old.')
})

test('replacePromptInputs - handles mixed formats', () => {
  const prompt = 'Hello {{name}}, you are {{age::25}} years old and work as {{job:Your job:Developer}}.'
  const inputs = { name: 'Alice', job: 'Designer' }
  const result = replacePromptInputs(prompt, inputs)
  
  expect(result).toBe('Hello Alice, you are {{age::25}} years old and work as Designer.')
})

test('getMissingInputs - returns inputs not provided', () => {
  const prompt = 'Hello {{name}}, you are {{age}} years old and live in {{city}}.'
  const inputs = { name: 'John' }
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(2)
  expect(missing[0]).toEqual({
    name: 'age',
    description: undefined
  })
  expect(missing[1]).toEqual({
    name: 'city',
    description: undefined
  })
})

test('getMissingInputs - returns empty array when all inputs provided', () => {
  const prompt = 'Hello {{name}}, you are {{age}} years old.'
  const inputs = { name: 'John', age: '25' }
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(0)
})

test('getMissingInputs - returns empty array when no inputs in prompt', () => {
  const prompt = 'This is a prompt without any inputs.'
  const inputs = { name: 'John' }
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(0)
})

test('getMissingInputs - handles inputs with descriptions', () => {
  const prompt = 'Hello {{name:The user\'s name}}, you are {{age:The user\'s age}} years old.'
  const inputs = { name: 'John' }
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(1)
  expect(missing[0]).toEqual({
    name: 'age',
    description: 'The user\'s age'
  })
})

test('getMissingInputs - extra inputs in object are ignored', () => {
  const prompt = 'Hello {{name}}!'
  const inputs = { name: 'John', age: '25', city: 'New York' }
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(0)
})

test('getMissingInputs - missing keys are considered missing', () => {
  const prompt = 'Hello {{name}}, you are {{age}} years old.'
  const inputs = { name: 'John' } // age key is missing entirely
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(1)
  expect(missing[0]).toEqual({
    name: 'age',
    description: undefined
  })
})

test('getMissingInputs - empty string values are not considered missing', () => {
  const prompt = 'Hello {{name}}, you are {{age}} years old.'
  const inputs = { name: 'John', age: '' }
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(0)
})

test('getMissingInputs - inputs with default values are still considered missing', () => {
  const prompt = 'Hello {{name::John}}, you are {{age:Your age:25}} years old.'
  const inputs = { name: 'Alice' }
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(1)
  expect(missing[0]).toEqual({
    name: 'age',
    description: 'Your age',
    defaultValue: '25'
  })
})

test('getMissingInputs - returns all inputs when none provided, including default values', () => {
  const prompt = 'Hello {{name::John}}, you are {{age:Your age:25}} years old and work as {{job}}.'
  const inputs = {}
  const missing = getMissingInputs(prompt, inputs)
  
  expect(missing).toHaveLength(3)
  expect(missing[0]).toEqual({
    name: 'name',
    description: undefined,
    defaultValue: 'John'
  })
  expect(missing[1]).toEqual({
    name: 'age',
    description: 'Your age',
    defaultValue: '25'
  })
  expect(missing[2]).toEqual({
    name: 'job',
    description: undefined,
    defaultValue: undefined
  })
})

test('complex scenario - multiple functions working together', () => {
  const prompt = 'Hello {{name:Your name}}, you are {{age}} years old and work as a {{job:Your profession}}.'

  // Extract inputs
  const extractedInputs = extractPromptInputs(prompt)
  expect(extractedInputs).toHaveLength(3)

  // Provide partial inputs
  const providedInputs = { name: 'Alice', job: 'Developer' }

  // Check missing inputs
  const missingInputs = getMissingInputs(prompt, providedInputs)
  expect(missingInputs).toHaveLength(1)
  expect(missingInputs[0].name).toBe('age')

  // Replace with partial inputs
  const partialResult = replacePromptInputs(prompt, providedInputs)
  expect(partialResult).toBe('Hello Alice, you are {{age}} years old and work as a Developer.')

  // Provide all inputs
  const allInputs = { name: 'Alice', age: '30', job: 'Developer' }

  // Check no missing inputs
  const noMissingInputs = getMissingInputs(prompt, allInputs)
  expect(noMissingInputs).toHaveLength(0)

  // Replace with all inputs
  const finalResult = replacePromptInputs(prompt, allInputs)
  expect(finalResult).toBe('Hello Alice, you are 30 years old and work as a Developer.')
})

test('extractAllWorkflowInputs - single step with inputs', () => {
  const steps = [
    { prompt: 'Hello {{name}}, you are {{age}} years old.' }
  ]
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(2)
  expect(inputs[0].name).toBe('name')
  expect(inputs[1].name).toBe('age')
})

test('extractAllWorkflowInputs - multiple steps deduplicates variables', () => {
  const steps = [
    { prompt: 'Hello {{name}}, you are {{age}} years old.' },
    { prompt: 'Your name {{name}} is nice, and you live in {{city}}.' }
  ]
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(3)
  expect(inputs.map(i => i.name)).toEqual(['name', 'age', 'city'])
})

test('extractAllWorkflowInputs - filters system variable output.N', () => {
  const steps = [
    { prompt: '{{input}} {{output.1}} {{output.2}}' }
  ]
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(1)
  expect(inputs[0].name).toBe('input')
})

test('extractAllWorkflowInputs - filters system variable facts', () => {
  const steps = [
    { prompt: 'Use {{userQuery}} and {{facts}} to answer.' }
  ]
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(1)
  expect(inputs[0].name).toBe('userQuery')
})

test('extractAllWorkflowInputs - filters system variable run-output', () => {
  const steps = [
    { prompt: 'Process {{input}} and return {{run-output}}.' }
  ]
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(1)
  expect(inputs[0].name).toBe('input')
})

test('extractAllWorkflowInputs - handles steps with no prompt', () => {
  const steps = [
    { prompt: 'Hello {{name}}' },
    { prompt: null },
    { prompt: 'You are {{age}} years old' }
  ]
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(2)
  expect(inputs.map(i => i.name)).toEqual(['name', 'age'])
})

test('extractAllWorkflowInputs - empty steps array returns empty array', () => {
  const steps = []
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(0)
})

test('extractAllWorkflowInputs - preserves descriptions and default values', () => {
  const steps = [
    { prompt: 'Hello {{name:Your name:John}}' },
    { prompt: 'You are {{age:Your age:25}} years old' }
  ]
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(2)
  expect(inputs[0]).toEqual({
    name: 'name',
    description: 'Your name',
    defaultValue: 'John'
  })
  expect(inputs[1]).toEqual({
    name: 'age',
    description: 'Your age',
    defaultValue: '25'
  })
})

test('extractAllWorkflowInputs - complex scenario with user and system variables', () => {
  const steps = [
    { prompt: 'Query: {{userQuery:The user query}}' },
    { prompt: 'Use {{output.1}} to generate {{numSections:Number of sections:3}} sections' },
    { prompt: 'Combine {{facts}} with {{output.2}} and previous result {{run-output}}' }
  ]
  const inputs = extractAllWorkflowInputs(steps)

  expect(inputs).toHaveLength(2)
  expect(inputs.map(i => i.name)).toEqual(['userQuery', 'numSections'])
  expect(inputs[1].defaultValue).toBe('3')
})
