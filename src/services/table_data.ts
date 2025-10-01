import * as XLSX from 'xlsx'

/**
 * Parse an HTML table element into a 2D array
 */
export function parseHtmlTable(html: string): string[][] {
  // Create a temporary DOM element to parse the HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')

  if (!table) {
    return []
  }

  const rows: string[][] = []

  // Process thead
  const thead = table.querySelector('thead')
  if (thead) {
    const headerRows = thead.querySelectorAll('tr')
    headerRows.forEach(tr => {
      const cells: string[] = []
      tr.querySelectorAll('th, td').forEach(cell => {
        cells.push(cell.textContent?.trim() || '')
      })
      if (cells.length > 0) {
        rows.push(cells)
      }
    })
  }

  // Process tbody
  const tbody = table.querySelector('tbody')
  const bodyRows = tbody ? tbody.querySelectorAll('tr') : table.querySelectorAll('tr')
  bodyRows.forEach(tr => {
    // Skip if this row is in thead (already processed)
    if (thead && thead.contains(tr)) {
      return
    }
    const cells: string[] = []
    tr.querySelectorAll('th, td').forEach(cell => {
      cells.push(cell.textContent?.trim() || '')
    })
    if (cells.length > 0) {
      rows.push(cells)
    }
  })

  return rows
}

/**
 * Convert a 2D array to CSV format
 */
export function arrayToCSV(data: string[][]): string {
  return data.map(row => {
    return row.map(cell => {
      // Escape quotes and wrap in quotes if necessary
      const needsQuotes = cell.includes(',') || cell.includes('"') || cell.includes('\n')
      if (needsQuotes) {
        return `"${cell.replace(/"/g, '""')}"`
      }
      return cell
    }).join(',')
  }).join('\n')
}

/**
 * Convert a 2D array to XLSX blob
 */
export function arrayToXLSX(data: string[][]): Blob {
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * Trigger a file download
 */
export function downloadFile(content: string | Blob, filename: string): void {
  let b64contents: string

  if (typeof content === 'string') {
    b64contents = window.api.base64.encode(content)
  } else {
    // Convert Blob to base64
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer
      const bytes = new Uint8Array(arrayBuffer)
      const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '')
      b64contents = btoa(binary)

      window.api.file.save({
        contents: b64contents,
        properties: {
          filename,
          prompt: true
        }
      })
    }
    reader.readAsArrayBuffer(content)
    return
  }

  window.api.file.save({
    contents: b64contents,
    properties: {
      filename,
      prompt: true
    }
  })
}
