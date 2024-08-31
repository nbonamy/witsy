
import { expect, test, vi } from 'vitest'
import { extractAttachmentsFromHistory, listUnusedAttachments } from '../../src/main/history'
import Chat from '../../src/models/chat'
import { app } from 'electron'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: () => ''
    },
  }
})
  
vi.mock('fs', async (importOriginal) => {
  const mod: any = await importOriginal()
  return { default: {
    ...mod,
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn(() => [
      'image1.png',
      'image2.png',
      'image3.jpg',
      'image4.png'
    ])
  }}
})


test('extract attachments - invalid', async () => {

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'Hello, world!' } ] },
    { messages: [ { content: 'http://images.image.png' } ] },
    { messages: [ { content: 'file://files/file.png' } ] },
    { messages: [ { content: 'file://images.file.png' } ] },
  ] as Chat[], 'images')).toEqual([])

})

test('extract attachments - content', async () => {

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'file://images/image.png' } ] }
  ] as Chat[], 'images')).toEqual(['image.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'file://images/image1.png' } ] },
    { messages: [ { content: 'file://images/image2.png' } ] }
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: '[image1](file://images/image1.png)' } ] },
    { messages: [ { content: '[image2](file://images/image2.png)[image3](file://images/image3.png)' } ] }
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png', 'image3.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'file://images/image1.png' } ] },
    { messages: [ { content: '[image2](file://images/image2.png)[image3](file://images/image3.png)' } ] }
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png', 'image3.png'])

})

test('extract attachments - attachment', async () => {

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachment: { url: 'file://images/image1.png' } } ] },
  ] as Chat[], 'images')).toEqual(['image1.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachment: { url: 'file://images/image1.png' } } ] },
    { messages: [ { attachment: { url: 'file://images/image2.png' } } ] },
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png'])

})

test('extract attachments - mixed', async () => {

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'Hello, world!' } ] },
    { messages: [ { content: 'file://files/file.png' } ] },
    { messages: [ { content: 'file://images/image1.png', attachment: { url: 'file://images/image2.png' } } ] },
    { messages: [ { content: '[image3](file://images/image3.png)' } ] },
    { messages: [ { content: 'file://images/image4.png' } ] },
    { messages: [ { content: 'file://images.file6.png', attachment: { url: 'file://images/image5.png' } } ] },
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png', 'image3.png', 'image4.png', 'image5.png'])

})

test('unused attachments', async () => {

  expect(listUnusedAttachments(app, [
    { messages: [ { content: 'file://images/image1.png', attachment: { url: 'file://images/image2.png' } } ] },
  ] as Chat[])).toEqual(['images/image3.jpg','images/image4.png'])

})
