import { expect, test } from 'vitest'
import Message from '../../src/models/message'

window.api = {
  base64: {
    decode: (data: string) => data
  },
  file: {
    extractText: (contents) => contents
  }
}

test('Build from role and text', () => {
  const message = new Message('user', 'content')
  expect(message.uuid).not.toBe(null)
  expect(message.role).toBe('user')
  expect(message.type).toBe('text')
  expect(message.content).toBe('content')
  expect(message.attachment).toBe(null)
  expect(message.toolCall).toBe(null)
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
  expect(message1.attachment).toBe(null)
  expect(message1.transient).toBe(false)
  expect(message1.toolCall).toBe(null)

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
  expect(message2.attachment).not.toBe(null)
  expect(message2.transient).toBe(false)
  expect(message2.toolCall).toBe(null)
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
