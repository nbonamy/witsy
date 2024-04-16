import { expect, test } from 'vitest'
import Message from '../../src/models/message'

test('Build from role and text', () => {
  const message = new Message('user', 'content')
  expect(message.uuid).not.toBe(null)
  expect(message.role).toBe('user')
  expect(message.content).toBe('content')
  expect(message.type).toBe('text')
  expect(message.attachment).toBe(null)
  expect(message.transient).toBe(false)
  expect(message.toolCall).toBe(null)
  expect(message.createdAt - Date.now()).toBeLessThan(100)  
})

test('Build from JSON', () => {
  const message = new Message(null, {
    uuid: 'uuid',
    type: 'text',
    createdAt: 1,
    role: 'role',
    content: 'content',
    attachment: null,
    transient: true,
  })
  expect(message.uuid).toBe('uuid')
  expect(message.role).toBe('role')
  expect(message.content).toBe('content')
  expect(message.type).toBe('text')
  expect(message.attachment).toBe(null)
  expect(message.transient).toBe(false)
  expect(message.toolCall).toBe(null)
})

test('Text message', () => {
  const message = new Message('user', '')
  message.setText(null)
  expect(message.transient).toBe(true)
  message.appendText({ text: 'content', done: false })
  expect(message.content).toBe('content')
  expect(message.transient).toBe(true)
  message.appendText({ text: ' more content', done: true })
  expect(message.content).toBe('content more content')
  expect(message.transient).toBe(false)
})

test('Image message', () => {
  const message = new Message('user', '')
  message.setImage('url')
  expect(message.type).toBe('image')
  expect(message.content).toBe('url')
})
