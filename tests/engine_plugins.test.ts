
import { beforeEach, expect, test } from 'vitest'
import { store } from '../src/services/store'
import defaults from '../defaults/settings.json'
import LlmMock from './mocks/llm'

beforeEach(() => {
  store.config = defaults
  store.config.llm.engine = 'mock'
  store.config.plugins.browse = {
    enabled: true,
  }
  store.config.plugins.tavily = {
    enabled: true,
    apiKey: '123',
  }
  store.config.plugins.python = {
    enabled: true,
    binpath: 'python3',
  }
})

test('Plugins', () => {
  const llm = new LlmMock(store.config)
  expect(llm.getAvailableTools()).toStrictEqual([
    {
      type: 'function',
      function: {
        name: 'get_html_as_text',
        description: 'Download an HTML page and return the text content',
        parameters: {
          type: 'object',
          properties: {
            'url': {
              type: 'string',
              'enum': undefined,
              description: 'The URL of the page to download',
            }
          },
          required: ['url'],
        },
      },
    },
    {
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
    },
    {
      type: 'function',
      function: {
        name: 'search_tavily',
        description: 'This tool allows you to search the web for information on a given topic',
        parameters: {
          type: 'object',
          properties: {
            'query': {
              type: 'string',
              'enum': undefined,
              description: 'The query to search for',
            }
          },
          required: ['query'],
        },
      },
    },
  ])
})
