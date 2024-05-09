
export default class Attachment {

  url: string
  format: string
  contents: string
  downloaded: boolean

  constructor({ url, format, contents, downloaded }: Attachment) {
    this.url = url
    this.format = format.toLowerCase()
    this.contents = contents
    this.downloaded = downloaded

    // text formats
    if (format === 'txt') {
      this.contents = window.api.base64.decode(contents)
    } else if (format === 'pdf') {
      this.loadPDFRawText()
    }
  }

  loadPDFRawText(): void {
    const rawText = window.api.pdf.getText(this.contents)
    //console.log('PDF raw text:', rawText)
    this.contents = rawText
  }

}
