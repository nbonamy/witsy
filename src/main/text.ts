
import PDFParser from 'pdf2json'

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

export function getTextContent(contents: string, format: string): Promise<string> {
  switch (format) {
    case 'pdf':
      return getPDFRawTextContent(contents)
    default:
      return Promise.resolve(contents)
  }
}
