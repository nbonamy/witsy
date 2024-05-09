
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
    } else {
      this.extractText()
    }
  }

  extractText(): void {
    const rawText = window.api.file.extractText(this.contents, this.format)
    //console.log('Raw text:', rawText)
    this.contents = rawText
  }

}
