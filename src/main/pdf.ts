
import PDFParser from 'pdf2json'

export function getPDFRawTextContent(contents: string): Promise<any> {
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
