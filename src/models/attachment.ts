
export const textFormats = ['pdf', 'txt', 'docx', 'pptx', 'xlsx']
export const imageFormats = ['jpeg', 'jpg', 'png', 'webp']

export default class Attachment {

  url: string
  format: string
  contents: string
  downloaded: boolean

  constructor(url: string, format = "", contents = "", downloaded = false) {
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

  isText(): boolean {
    return textFormats.includes(this.format)
  }

  isImage(): boolean {
    return imageFormats.includes(this.format)
  }

  extractText(): void {
    const rawText = window.api.file.extractText(this.contents, this.format)
    //console.log('Raw text:', rawText)
    this.contents = rawText
  }

}
