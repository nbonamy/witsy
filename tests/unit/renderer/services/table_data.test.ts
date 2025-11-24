import { expect, test } from 'vitest'
import { arrayToCSV, arrayToXLSX, parseHtmlTable } from '@services/table_data'

test('parseHtmlTable - simple table', () => {
  const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Age</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Alice</td>
          <td>30</td>
        </tr>
        <tr>
          <td>Bob</td>
          <td>25</td>
        </tr>
      </tbody>
    </table>
  `
  const result = parseHtmlTable(html)
  expect(result).toEqual([
    ['Name', 'Age'],
    ['Alice', '30'],
    ['Bob', '25']
  ])
})

test('parseHtmlTable - table without thead', () => {
  const html = `
    <table>
      <tr>
        <td>Alice</td>
        <td>30</td>
      </tr>
      <tr>
        <td>Bob</td>
        <td>25</td>
      </tr>
    </table>
  `
  const result = parseHtmlTable(html)
  expect(result).toEqual([
    ['Alice', '30'],
    ['Bob', '25']
  ])
})

test('parseHtmlTable - empty string', () => {
  const result = parseHtmlTable('')
  expect(result).toEqual([])
})

test('parseHtmlTable - no table', () => {
  const result = parseHtmlTable('<div>No table here</div>')
  expect(result).toEqual([])
})

test('arrayToCSV - simple data', () => {
  const data = [
    ['Name', 'Age'],
    ['Alice', '30'],
    ['Bob', '25']
  ]
  const result = arrayToCSV(data)
  expect(result).toBe('Name,Age\nAlice,30\nBob,25')
})

test('arrayToCSV - data with commas', () => {
  const data = [
    ['Name', 'City'],
    ['Alice', 'New York, NY'],
    ['Bob', 'Los Angeles, CA']
  ]
  const result = arrayToCSV(data)
  expect(result).toBe('Name,City\nAlice,"New York, NY"\nBob,"Los Angeles, CA"')
})

test('arrayToCSV - data with quotes', () => {
  const data = [
    ['Name', 'Quote'],
    ['Alice', 'She said "hello"'],
    ['Bob', 'He said "goodbye"']
  ]
  const result = arrayToCSV(data)
  expect(result).toBe('Name,Quote\nAlice,"She said ""hello"""\nBob,"He said ""goodbye"""')
})

test('arrayToXLSX - creates blob with correct content', async () => {
  const data = [
    ['Name', 'Age'],
    ['Alice', '30'],
    ['Bob', '25']
  ]
  const result = arrayToXLSX(data)
  expect(result).toBeInstanceOf(Blob)
  expect(result.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

  // Convert blob to base64 and verify it matches expected XLSX structure
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer
      const bytes = new Uint8Array(arrayBuffer)
      const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '')
      resolve(btoa(binary))
    }
    reader.readAsArrayBuffer(result)
  })

  // XLSX files start with PK (ZIP signature) - 'PK\x03\x04' in base64 is 'UEsD'
  expect(base64.substring(0, 4)).toBe('UEsD')

  // Verify blob size is reasonable for this small table
  expect(result.size).toBeGreaterThan(1000)
  expect(result.size).toBeLessThan(20000)
})
