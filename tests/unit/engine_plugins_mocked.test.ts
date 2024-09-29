
import { vi, beforeEach, expect, test } from 'vitest'
import { Plugin1, Plugin2, Plugin3 } from '../mocks/plugins'
import OpenAI from '../../src/services/openai'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'

vi.mock('../../src/plugins/plugins', async () => {
  return {
    availablePlugins: {
      plugin1: Plugin1,
      plugin2: Plugin2,
      plugin3: Plugin3,
    }
  }
})

beforeEach(() => {
  store.config = defaults
  store.config.llm.engine = 'mock'
})

test('Engine plugin descriptions', () => {
  const llm = new OpenAI(store.config)
  expect(llm.getToolPreparationDescription('plugin1')).toBeNull()
  expect(llm.getToolRunningDescription('plugin1')).toBe('run1')
  expect(llm.getToolPreparationDescription('plugin2')).toBe('prep2')
  expect(llm.getToolRunningDescription('plugin2')).toBe('run2')
})

test('Engine plugin execution', async () => {
  const llm = new OpenAI(store.config)
  expect(await llm.callTool('plugin1', {})).toStrictEqual('result1')
  expect(await llm.callTool('plugin2', { param1: 'a', param2: 1 })).toStrictEqual({ param1: 'a', param2: 1 })
})

test('OpenAI Functions', async () => {
  const llm = new OpenAI(store.config)
  expect(await llm.getAvailableTools()).toStrictEqual([
    {
      type: 'function',
      function: {
        name: 'plugin1',
        description: 'Plugin 1',
        parameters: {
          type: 'object',
          properties: { },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'plugin2',
        description: 'Plugin 2',
        parameters: {
          type: 'object',
          properties: {
            'param1': {
              type: 'string',
              'enum': undefined,
              description: 'Parameter 1',
            },
            'param2': {
              type: 'number',
              'enum': undefined,
              description: 'Parameter 2',
            },
          },
          required: ['param1'],
        },
      },
    },
  ])
})
