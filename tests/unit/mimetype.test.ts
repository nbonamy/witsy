
import { expect, test } from 'vitest'
import { mimeTypeToExtension } from '../../src/main/mimetype'

test('MIME type to extension', async () => {
  expect(mimeTypeToExtension('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx')
  expect(mimeTypeToExtension('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('pptx')
  expect(mimeTypeToExtension('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('xlsx')
  expect(mimeTypeToExtension('text/plain')).toBe('txt')
  expect(mimeTypeToExtension('application/pdf')).toBe('pdf')
})
