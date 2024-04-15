
import { beforeEach, expect, test } from 'vitest'
import { store } from '../src/services/store'
import defaults from '../defaults/settings.json'
import LlmMock from './mocks/llm'

beforeEach(() => {
  store.config = defaults
  store.config.llm.engine = 'mock'
  store.config.plugins.python = {
    enabled: true,
    binpath: 'python3',
  }
})

test('Plugins', () => {
  const llm = new LlmMock(store.config)
  expect(llm.getAvailableTools()).toStrictEqual([{
    type: 'function',
    function: {
      name: 'run_python_code',
      description: 'Execute Python code and return the result',
      parameters: {
        type: 'object',
        properties: {
          'script': {
            type: 'string',
            'enum': undefined,
            description: 'The script to run',
          }
        },
        required: ['script'],
      },
    },
  }])
})
