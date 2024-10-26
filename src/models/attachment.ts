
import { Attachment as AttachmentBase, extensionToMimeType } from 'multi-llm-ts'

export { textFormats } from 'multi-llm-ts'
export { imageFormats } from 'multi-llm-ts'

export default class Attachment extends AttachmentBase {

  url: string
  extracted: boolean
  saved: boolean

  constructor(contents: string, mimeType: string, url: string = '', saved: boolean = false, load: boolean = false) {
    super(contents, mimeType)
    this.url = url
    this.saved = saved
    this.extracted = false
    if (load) {
      this.loadContents()
    }
  }

  loadContents(): void {

    // not if we already have
    if (this.contents) {
      if (this.isText() && !this.extracted) {
        this.extractText()
      }
      return
    }

    // get contents
    if (!this.contents && this.url) {
      this.contents = window.api.file.read(this.url.replace('file://', '')).contents
    }

    // text formats
    if (this.contents) {
      if (this.isText()) {
        this.extractText()
      } else {
        this.contents = window.api.base64.decode(this.contents)
      }
    } 
  }

  b64Contents(): string {
    if (this.isText()) {
      return window.api.base64.encode(this.contents)
    } else {
      return this.contents
    }
  }

  static fromJson(obj: any): Attachment {
    return new Attachment(obj.contents, obj.mimeType || extensionToMimeType(obj.format || ''), obj.url, obj.saved || obj.downloaded)
  }
  
  private extractText(): void {

    // get text
    if (this.format() === 'txt') {
      this.contents = window.api.base64.decode(this.contents)
    } else {
      const rawText = window.api.file.extractText(this.contents, this.format())
      this.mimeType = 'text/plain'
      this.contents = rawText
    }

    // save
    this.extracted = true
  }

}
