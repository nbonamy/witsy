
import { app } from 'electron'
import PDFParser from 'pdf2json'
import officeParser from 'officeparser'

function getPDFRawTextContent(contents: string): Promise<string> {
  const pdfParser = new PDFParser(undefined, 1)
  return new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', (errData: {parserError: any}) =>
      reject(errData.parserError)
    )
    pdfParser.on('pdfParser_dataReady', () => {
      resolve(pdfParser.getRawTextContent())
    })
    pdfParser.parseBuffer(Buffer.from(contents, 'base64'))
  })
}

function getOfficeRawTextContent(contents: string): Promise<string> {
  return officeParser.parseOfficeAsync(Buffer.from(contents, 'base64'), {
    tempFilesLocation: app.getPath('temp'),
  })
}

export function getTextContent(contents: string, format: string): Promise<string> {
  switch (format) {
    case 'txt':
      return Promise.resolve(Buffer.from(contents, 'base64').toString('utf-8'))
    case 'pdf':
      return getPDFRawTextContent(contents)
    case 'docx':
    case 'pptx':
    case 'xlsx':
      return getOfficeRawTextContent(contents)
    default:
      return Promise.resolve(contents)
  }
}
