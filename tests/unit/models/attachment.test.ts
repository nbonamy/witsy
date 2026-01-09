
import { beforeAll, test, expect } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import Attachment from '@models/attachment'

beforeAll(() => {
  useWindowMock()
})

test('isText()', async () => {
  const text = new Attachment('text', 'text/plain', 'url', false)
  expect(text.isText()).toBe(true)

  const pdf = new Attachment('pdf', 'application/pdf', 'url', false)
  expect(pdf.isText()).toBe(true)

  const image = new Attachment('image', 'image/png', 'url', false)
  expect(image.isText()).toBe(false)
})

test('Constructs without transformation', async () => {
  const text = new Attachment('text', 'text/plain', 'url', false)
  expect(text.content).toBe('text')
  expect(text.mimeType).toBe('text/plain')
  expect(text.url).toBe('url')
  expect(text.saved).toBe(false)
  expect(text.extracted).toBe(false)

  const image = new Attachment('image', 'image/png', 'url', false)
  expect(image.content).toBe('image')
  expect(image.mimeType).toBe('image/png')
  expect(image.url).toBe('url')
  expect(image.saved).toBe(false)
  expect(image.extracted).toBe(false)

  const pdf = Attachment.fromJson({ content: 'pdf', mimeType: 'application/pdf', url: 'url', saved: false })
  expect(pdf.content).toBe('pdf')
  expect(pdf.mimeType).toBe('application/pdf')
  expect(pdf.url).toBe('url')
  expect(pdf.saved).toBe(false)
  expect(image.extracted).toBe(false)

  const compat = Attachment.fromJson({ content: 'pdf', format: 'pdf', url: 'url', downloaded: true })
  expect(compat.content).toBe('pdf')
  expect(compat.mimeType).toBe('application/pdf')
  expect(compat.url).toBe('url')
  expect(compat.saved).toBe(true)
  expect(compat.extracted).toBe(false)

})

test('Load from contents', async () => {
  const text = await Attachment.load('text', 'text/plain', 'url', false)
  expect(text.content).toBe('text_decoded')
  expect(text.mimeType).toBe('text/plain')

  const pdf = await Attachment.load('pdf', 'application/pdf', 'url', false)
  expect(pdf.content).toBe('pdf_extracted')
  expect(pdf.mimeType).toBe('application/pdf')

  const image = await Attachment.load('image_encoded', 'image/png', 'url', false)
  expect(image.content).toBe('image_encoded')
  expect(image.mimeType).toBe('image/png')
})

test('Load from url', async () => {
  const text = await Attachment.load('', 'text/plain', 'file://text', false)
  expect(text.content).toBe('text_encoded_decoded')

  const pdf = await Attachment.load('', 'application/pdf', 'file://pdf', false)
  expect(pdf.content).toBe('pdf_encoded_extracted')

  const image = await Attachment.load('', 'image/png', 'file://image', false)
  expect(image.content).toBe('image_encoded')
})

test('Base64 contents', async () => {
  const text = await Attachment.load('text', 'text/plain', 'url', false)
  expect(text.b64Contents()).toBe('text_decoded_encoded')

  const pdf = await Attachment.load('pdf', 'application/pdf', 'url', false)
  expect(pdf.b64Contents()).toBe('pdf_extracted_encoded')

  const image = await Attachment.load('image_encoded', 'image/png', 'url', false)
  expect(image.b64Contents()).toBe('image_encoded')
})

