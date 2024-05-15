
import { Attachment } from '../types/index.d'

export const textFormats = ['pdf', 'txt', 'docx', 'pptx', 'xlsx']
export const imageFormats = ['jpeg', 'jpg', 'png', 'webp']

export default class implements Attachment {

  url: string
  format: string
  contents: string
  downloaded: boolean

  constructor(url: string|object, format = "", contents = "", downloaded = false) {

    if (url != null && typeof url === 'object') {
      this.fromJson(url)
      return
    }

    // default
    this.url = url as string
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

  fromJson(obj: any) {
    this.url = obj.url
    this.format = obj.format
    this.contents = obj.contents
    this.downloaded = obj.downloaded
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
