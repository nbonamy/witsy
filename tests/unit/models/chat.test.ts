import { beforeAll, expect, test } from 'vitest'
import Chat from '@models/chat'
import Message from '@models/message'
import { useWindowMock } from '@tests/mocks/window'

beforeAll(() => {
  useWindowMock()
})

test('Build from title', () => {
  const chat = new Chat('The chat title')
  expect(chat.uuid).not.toBeNull()
  expect(chat.title).toBe('The chat title')
  expect(chat.createdAt - Date.now()).toBeLessThan(100)  
  expect(chat.lastModified - Date.now()).toBeLessThan(100)  
  expect(chat.messages).toStrictEqual([])
})

test('Build from JSON', () => {
  const chat = Chat.fromJson({
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
  const chat = Chat.fromJson({
    uuid: 'uuid',
    title: 'title',
    createdAt: 1,
    lastModified: 1,
    engine: 'engine',
    model: 'model',
    docrepos: ['docrepo'],
    tools: [ 'tool1' ],
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
  expect(fork.docrepos).toStrictEqual(chat.docrepos)
  expect(fork.tools).toBe(chat.tools)
  expect(fork.messages.length).toBe(3)
  expect(fork.messages[0]).toMatchObject({ uuid: expect.not.stringMatching('^1$'), role: 'role1', content: 'content1' })
  expect(fork.messages[1]).toMatchObject({ uuid: expect.not.stringMatching('^2$'), role: 'role2', content: 'content2' })
  expect(fork.messages[2]).toMatchObject({ uuid: expect.not.stringMatching('^3$'), role: 'role3', content: 'content3' })

})

test('Delete Message', () => {
  const chat = Chat.fromJson({
    uuid: 'uuid',
    title: 'title',
    createdAt: 1,
    lastModified: 1,
    engine: 'engine',
    model: 'model',
    docrepos: ['docrepo'],
    tools: [],
    messages: [
      { uuid: '1', role: 'role1', content: 'content1' },
      { uuid: '2', role: 'role2', content: 'content2' },
      { uuid: '3', role: 'role3', content: 'content3' },
      { uuid: '4', role: 'role4', content: 'content4' },
    ]
  })

  chat.deleteMessagesStarting(chat.messages[2])
  expect(chat.messages.length).toBe(2)
  expect(chat.messages[0].uuid).toBe('1')
  expect(chat.messages[1].uuid).toBe('2')

})

test('Migrate legacy docrepo to docrepos on fromJson', () => {
  // Test with legacy docrepo field (backwards compatibility)
  const chat = Chat.fromJson({
    uuid: 'uuid',
    title: 'title',
    createdAt: 1,
    lastModified: 1,
    docrepo: 'legacy-docrepo',
    messages: []
  })
  expect(chat.docrepos).toStrictEqual(['legacy-docrepo'])
})

test('Prefer docrepos over legacy docrepo on fromJson', () => {
  // If both exist, docrepos takes precedence
  const chat = Chat.fromJson({
    uuid: 'uuid',
    title: 'title',
    createdAt: 1,
    lastModified: 1,
    docrepo: 'legacy-docrepo',
    docrepos: ['new-docrepo1', 'new-docrepo2'],
    messages: []
  })
  expect(chat.docrepos).toStrictEqual(['new-docrepo1', 'new-docrepo2'])
})

test('Migrate legacy docrepo to docrepos on patchFromJson', () => {
  const chat = new Chat('title')
  chat.patchFromJson({
    title: 'new title',
    lastModified: 2,
    docrepo: 'legacy-docrepo',
    messages: []
  })
  expect(chat.docrepos).toStrictEqual(['legacy-docrepo'])
})