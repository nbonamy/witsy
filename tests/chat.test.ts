import { expect, test } from 'vitest'
import Chat from '../src/models/chat'
import Message from '../src/models/message'

test('Build from title', () => {
  const chat = new Chat('The chat title')
  expect(chat.uuid).not.toBe(null)
  expect(chat.title).toBe('The chat title')
  expect(chat.createdAt - Date.now()).toBeLessThan(100)  
  expect(chat.lastModified - Date.now()).toBeLessThan(100)  
  expect(chat.messages).toStrictEqual([])
})

test('Build from JSON', () => {
  const chat = new Chat({
    uuid: 'uuid',
    title: 'title',
    createdAt: 1,
    lastModified: 1,
    messages: [
      { role: 'role', content: 'content' }
    ]
  })
  expect(chat.uuid).toBe('uuid')
  expect(chat.title).toBe('title')
  expect(chat.createdAt).toBe(1)
  expect(chat.lastModified).toBe(1)
  expect(chat.messages.length).toBe(1)
})

test('Patch from JSON', () => {
  const chat = new Chat('title')
  const patched = chat.patchFromJson({
    title: 'new title',
    lastModified: 2,
    messages: [
      { role: 'role', content: 'content' }
    ]
  })
  expect(patched).toBe(true)
  expect(chat.title).toBe('new title')
  expect(chat.lastModified).toBe(2)
  expect(chat.messages.length).toBe(1)
})

test('Subtitle', () => {
  const chat = new Chat('title')
  chat.addMessage(new Message('system', 'instructions'))
  chat.addMessage(new Message('user', 'content'))
  expect(chat.subtitle()).toBe('')
  chat.addMessage(new Message('assistant', 'this is the subtitle'))
  expect(chat.subtitle()).toBe('this is the subtitle')
})
