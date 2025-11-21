
import { test, expect } from 'vitest'
import Ollama from '@services/llms/ollama'
import { EngineCreateOpts } from 'multi-llm-ts'

test('Ollama no keep-alive', () => {
  const ollama = new Ollama({ keepAlive: '' } as EngineCreateOpts)
  expect(ollama.buildChatOptions({
    model: 'llama3.3:latest',
    messages: [],
    opts: null,
  })).toEqual({
    model: 'llama3.3:latest',
    messages: [],
  })
})

test('Ollama keep-alive string', () => {
  const ollama = new Ollama({ keepAlive: '10m' } as EngineCreateOpts)
  expect(ollama.buildChatOptions({
    model: 'llama3.3:latest',
    messages: [],
    opts: null,
  })).toEqual({
    keep_alive: '10m',
    model: 'llama3.3:latest',
    messages: [],
  })
})

test('Ollama keep-alive number', () => {
  const ollama = new Ollama({ keepAlive: '3600' } as EngineCreateOpts)
  expect(ollama.buildChatOptions({
    model: 'llama3.3:latest',
    messages: [],
    opts: null,
  })).toEqual({
    keep_alive: 3600,
    model: 'llama3.3:latest',
    messages: [],
  })
})
