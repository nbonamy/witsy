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
  expect(message.attachments).toStrictEqual([])
  expect(message.toolCalls).toStrictEqual([])
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
  expect(message1.attachments).toStrictEqual([])
  expect(message1.transient).toBe(false)
  expect(message1.toolCalls).toStrictEqual([])

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
  expect(message2.attachments).toHaveLength(1)
  expect(message2.transient).toBe(false)
  expect(message2.toolCalls).toStrictEqual([])

  const message3 = Message.fromJson({
    uuid: 'uuid',
    type: 'text',
    createdAt: 1,
    role: 'role',
    content: 'content',
    attachments: [
      { contents: 'image', mimeType: 'image/png', url: 'url', saved: false },
      { contents: 'image', mimeType: 'image/png', url: 'url', saved: false },
    ],
    transient: true,
  })
  expect(message3.uuid).toBe('uuid')
  expect(message3.role).toBe('role')
  expect(message3.type).toBe('text')
  expect(message3.content).toBe('content')
  expect(message3.attachments).toHaveLength(2)
  expect(message3.transient).toBe(false)
  expect(message3.toolCalls).toStrictEqual([])

  // backwards compatibility with toolCall
  const message4 = Message.fromJson({
    uuid: 'uuid',
    type: 'text',
    createdAt: 1,
    role: 'role',
    content: 'content',
    toolCall: { calls: [
      { name: 'tool1', params: ['arg1'], result: 'result1' },
      { name: 'tool2', params: ['arg2'], result: 'result2' },
    ], status: 'done' },
    transient: true,
  })
  expect(message4.toolCalls).toStrictEqual([
    { id: '1', name: 'tool1', done: true, status: undefined, params: ['arg1'], result: 'result1' },
    { id: '2', name: 'tool2', done: true, status: undefined, params: ['arg2'], result: 'result2' }
  ])

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

  // same tool update
  message.setToolCall({ type: 'tool', id: '1', name: 'tool1', status: 'Preparing the tool', done: false })
  expect(message.toolCalls).toHaveLength(1)
  message.setToolCall({ type: 'tool', id: '1', name: 'tool1', status: 'Calling the tool', done: false })
  expect(message.toolCalls).toHaveLength(1)
  message.setToolCall({ type: 'tool', id: '1', name: 'tool1', status: undefined, done: true })
  expect(message.toolCalls).toHaveLength(1)

  // new tool
  message.setToolCall({ type: 'tool', id: '2', name: 'tool2', status: 'Preparing the tool', done: false })
  expect(message.toolCalls).toHaveLength(2)
  message.setToolCall({ type: 'tool', id: '2', name: 'tool2', status: 'Preparing the tool', done: true })
  expect(message.toolCalls).toHaveLength(2)

  // special google case
  message.setToolCall({ type: 'tool', id: '2', name: 'tool2', status: 'Preparing the tool', done: false })
  expect(message.toolCalls).toHaveLength(3)

})
