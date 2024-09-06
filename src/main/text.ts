
import { app } from 'electron'
import PDFParser from 'pdf2json'
import officeParser from 'officeparser'

export function getPDFRawTextContent(contents: Buffer): Promise<string> {
  const pdfParser = new PDFParser(undefined, 1)
  return new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', (errData: {parserError: any}) =>
      reject(errData.parserError)
    )
    pdfParser.on('pdfParser_dataReady', () => {
      resolve(pdfParser.getRawTextContent())
    })
    pdfParser.parseBuffer(contents)
  })
}

export function getOfficeRawTextContent(contents: Buffer): Promise<string> {
  return officeParser.parseOfficeAsync(contents, {
    tempFilesLocation: app.getPath('temp'),
  })
}

export function getTextContent(b64contents: string, format: string): Promise<string> {
  switch (format) {
    case 'txt':
      return Promise.resolve(Buffer.from(b64contents, 'base64').toString('utf-8'))
    case 'pdf':
      return getPDFRawTextContent(Buffer.from(b64contents, 'base64'))
    case 'docx':
    case 'pptx':
    case 'xlsx':
      return getOfficeRawTextContent(Buffer.from(b64contents, 'base64'))
    default:
      return Promise.resolve(b64contents)
  }
}
