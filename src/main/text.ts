
import PDFParser from 'pdf2json'
import { parseOfficeAsync } from 'officeparser'
import csvToMarkdown from 'csv-to-markdown-table'
import * as XLSX from 'xlsx'

export function getPDFRawTextContent(contents: Buffer): Promise<string> {
  const pdfParser = new PDFParser(undefined, 1)
  return new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', (errData: {parserError: any}) => {
      //console.log('PDF parser error:', errData.parserError)
      reject(errData.parserError)
    })
    pdfParser.on('pdfParser_dataReady', () => {

      //console.log('PDF parsing done')
      const rawText = pdfParser.getRawTextContent()

      // special case for empty pdf (or image only)
      // ----------------Page (0) Break----------------
      if (/^-+Page \(\d+\) Break-+$/.test(rawText.trim())) {
        resolve('')
      } else {
        resolve(pdfParser.getRawTextContent())
      }
    })
    //console.log('Parsing PDF contents...')
    pdfParser.parseBuffer(contents)
  })
}

export function getOfficeRawTextContent(contents: Buffer): Promise<string> {
  return parseOfficeAsync(contents)
}

export function getExcelRawTextContent(contents: Buffer): Promise<string> {
  try {
    let content = ''
    const workbook = XLSX.read(contents, { type: 'buffer' })
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      const sheet = XLSX.utils.sheet_to_csv(worksheet)
      content += `Sheet: ${sheetName}\n`
      content += csvToMarkdown(sheet, ',').split('\n').map(l => l.trim()).join('\n') + '\n\n'
    }
    return Promise.resolve(content.trim())
  } catch {
    return getOfficeRawTextContent(contents)
  }
}

export function getTextContent(b64contents: string, format: string): Promise<string> {
  switch (format) {
    case 'txt':
      return Promise.resolve(Buffer.from(b64contents, 'base64').toString('utf-8'))
    case 'pdf':
      return getPDFRawTextContent(Buffer.from(b64contents, 'base64'))
    case 'docx':
    case 'pptx':
      return getOfficeRawTextContent(Buffer.from(b64contents, 'base64'))
    case 'xlsx':
      return getExcelRawTextContent(Buffer.from(b64contents, 'base64'))
    default:
      return Promise.resolve(b64contents)
  }
}
