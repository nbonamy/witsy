import { beforeAll, expect, test } from 'vitest'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'
import { useWindowMock } from '../mocks/window'

beforeAll(() => {
  useWindowMock()
})

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

test('Delete', () => {
  const chat = new Chat('title')
  chat.addMessage(Message.fromJson({ role: 'role', type: 'image', content: 'file' })) 
  chat.addMessage(Message.fromJson({ role: 'role', attachment: { saved: true, url: 'url' } }))
  chat.addMessage(Message.fromJson({ role: 'role', attachment: { saved: false, url: 'url' } }))
  chat.delete()
  expect(window.api.file.delete).toHaveBeenCalledTimes(2)
  expect(window.api.file.delete).toHaveBeenNthCalledWith(1, 'file')
  expect(window.api.file.delete).toHaveBeenNthCalledWith(2, 'url')
})

test('Fork', () => {
  const chat = new Chat({
    uuid: 'uuid',
    title: 'title',
    createdAt: 1,
    lastModified: 1,
    engine: 'engine',
    model: 'model',
    docrero: 'docrepo',
    disableTools: true,
    messages: [
      { uuid: '1', role: 'role1', content: 'content1' },
      { uuid: '2', role: 'role2', content: 'content2' },
      { uuid: '3', role: 'role3', content: 'content3' },
      { uuid: '4', role: 'role4', content: 'content4' },
    ]
  })
  
  const fork = chat.fork(chat.messages[2])
  expect(fork.uuid).not.toBe(chat.uuid)
  expect(fork.title).toBe(chat.title)
  expect(fork.createdAt).toBe(chat.createdAt)
  expect(fork.lastModified).not.toBe(chat.lastModified)
  expect(fork.engine).toBe(chat.engine)
  expect(fork.model).toBe(chat.model)
  expect(fork.docrepo).toBe(chat.docrepo)
  expect(fork.disableTools).toBe(chat.disableTools)
  expect(fork.deleted).toBe(false)
  expect(fork.messages.length).toBe(3)
  expect(fork.messages[0]).toMatchObject({ uuid: expect.not.stringMatching('^1$'), role: 'role1', content: 'content1' })
  expect(fork.messages[1]).toMatchObject({ uuid: expect.not.stringMatching('^2$'), role: 'role2', content: 'content2' })
  expect(fork.messages[2]).toMatchObject({ uuid: expect.not.stringMatching('^3$'), role: 'role3', content: 'content3' })

})
