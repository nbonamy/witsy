
import { vi, test, expect } from 'vitest'
import Nestor from '../../src/main/nestor'

let error = false

vi.mock('nestor-client', () => {
  return {
    NestorClient: class {
      async status() {
        if (error) throw new Error('Error')
        return { status: 'ok' }
      }

      async list() {
        if (error) throw new Error('Error')
          return [{ name: 'tool1' }, { name: 'tool2' }]
      }

      async call(name: string, parameters: any) {
        if (error) throw new Error('Error')
          return { name, parameters }
      }
    }
  }
})

test('Nestor', async () => {
  const nestor = new Nestor()
  expect(nestor).toBeDefined()
  expect(nestor.nestor).toBeDefined()
})

test('getStatus', async () => {
  const nestor = new Nestor()
  const status = await nestor.getStatus()
  expect(status).toEqual({ status: 'ok' })
})

test('getTools', async () => {
  const nestor = new Nestor()
  const tools = await nestor.getTools()
  expect(tools).toEqual([{ name: 'tool1' }, { name: 'tool2' }])
})

test('callTool', async () => {
  const nestor = new Nestor()
  const result = await nestor.callTool('tool1', { param: 'value' })
  expect(result).toEqual({ name: 'tool1', parameters: { param: 'value' } })
})

test('errors', async () => {
  error = true
  const nestor = new Nestor()
  expect(await nestor.getStatus()).toEqual([])
  expect(await nestor.getTools()).toEqual([])
  expect(await nestor.callTool('tool1', { param: 'value' })).toEqual({ error: 'Error' })
})
