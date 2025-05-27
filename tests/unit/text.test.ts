
import { vi, expect, test } from 'vitest'
import { getTextContent } from '../../src/main/text'
import fs from 'fs'

vi.mock('electron', async () => {
  return {
    app: {
      getPath: vi.fn()
    }
  }
})

test('TXT', async () => {
  const contents = fs.readFileSync('./tests/fixtures/sample.txt', 'base64')
  const text = await getTextContent(contents, 'txt')
  expect(text).toContain('Hello from TEXT')
})

test('PDF', async () => {
  const contents = fs.readFileSync('./tests/fixtures/sample.pdf', 'base64')
  const text = await getTextContent(contents, 'pdf')
  expect(text).toContain('Hello from PDF')

  const empty = fs.readFileSync('./tests/fixtures/empty.pdf', 'base64')
  expect(await getTextContent(empty, 'pdf')).toBe('')
})

test('Word', async () => {
  const contents = fs.readFileSync('./tests/fixtures/sample.docx', 'base64')
  const text = await getTextContent(contents, 'docx')
  expect(text).toContain('Hello from Word')
})

test('PowerPoint', async () => {
  const contents = fs.readFileSync('./tests/fixtures/sample.pptx', 'base64')
  const text = await getTextContent(contents, 'pptx')
  expect(text).toContain('Hello from PowerPoint')
})

test('Excel', async () => {
  const contents = fs.readFileSync('./tests/fixtures/sample.xlsx', 'base64')
  const text = await getTextContent(contents, 'xlsx')
  expect(text).toContain('Hello from Excel')
})
