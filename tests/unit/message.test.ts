import { beforeAll, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import Message from '../../src/models/message'

beforeAll(() => {
  useWindowMock()
})

test('Build from role and text', () => {
  const message = new Message('user', 'content')
  expect(message.uuid).not.toBeNull()
  expect(message.role).toBe('user')
  expect(message.type).toBe('text')
  expect(message.content).toBe('content')
  expect(message.attachment).toBeNull()
  expect(message.toolCall).toBeNull()
  expect(message.transient).toBe(false)
  expect(message.createdAt - Date.now()).toBeLessThan(100)  
})

test('Build from JSON', () => {
  const message1 = Message.fromJson({
    uuid: 'uuid',
    type: 'text',
    createdAt: 1,
    role: 'role',
    content: 'content',
    attachment: null,
    transient: true,
  })
  expect(message1.uuid).toBe('uuid')
  expect(message1.role).toBe('role')
  expect(message1.type).toBe('text')
  expect(message1.content).toBe('content')
  expect(message1.attachment).toBeNull()
  expect(message1.transient).toBe(false)
  expect(message1.toolCall).toBeNull()

  const message2 = Message.fromJson({
    uuid: 'uuid',
    type: 'text',
    createdAt: 1,
    role: 'role',
    content: 'content',
    attachment: { contents: 'image', mimeType: 'image/png', url: 'url', saved: false },
    transient: true,
  })
  expect(message2.uuid).toBe('uuid')
  expect(message2.role).toBe('role')
  expect(message2.type).toBe('text')
  expect(message2.content).toBe('content')
  expect(message2.attachment).not.toBeNull()
  expect(message2.transient).toBe(false)
  expect(message2.toolCall).toBeNull()
})

test('Text message', () => {
  const message = new Message('user')
  expect(message.transient).toBe(true)
  message.appendText({ type: 'content', text: 'content', done: false })
  expect(message.content).toBe('content')
  expect(message.transient).toBe(true)
  message.appendText({ type: 'content', text: ' more content', done: true })
  expect(message.content).toBe('content more content')
  expect(message.transient).toBe(false)
})

test('Image message', () => {
  const message = new Message('user', '')
  message.setImage('url')
  expect(message.type).toBe('image')
  expect(message.content).toBe('url')
})

test('Tool call message', () => {
  const message = new Message('user')
  message.setToolCall({ type: 'tool', name: 'tool', status: 'Calling a tool', done: false })
  expect(message.toolCall).not.toBeNull()
  expect(message.toolCall!.status).toBe('Calling a tool')
  expect(message.toolCall!.calls).toStrictEqual([])
  message.setToolCall({ type: 'tool', name: 'tool', status: 'Calling a tool', done: true })
  expect(message.toolCall!.status).toBeNull()
  expect(message.toolCall!.calls).toStrictEqual([])
  message.setToolCall({ type: 'tool', name: 'tool1', call: { params: ['arg1'], result: 'result1' }, done: true })
  expect(message.toolCall!.status).toBeNull()
  expect(message.toolCall!.calls.length).toBe(1)
  expect(message.toolCall!.calls[0]).toStrictEqual({ name: 'tool1', params: ['arg1'], result: 'result1' })
  message.setToolCall({ type: 'tool', name: 'tool2', call: { params: ['arg2'], result: 'result2' }, done: true })
  expect(message.toolCall!.calls.length).toBe(2)
  expect(message.toolCall!.calls[0]).toStrictEqual({ name: 'tool1', params: ['arg1'], result: 'result1' })
  expect(message.toolCall!.calls[1]).toStrictEqual({ name: 'tool2', params: ['arg2'], result: 'result2' })
})
