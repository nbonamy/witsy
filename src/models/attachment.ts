
import { Attachment as IAttachment } from '../types'
import { Attachment as AttachmentBase, extensionToMimeType } from 'multi-llm-ts'

export { textFormats } from 'multi-llm-ts'
export { imageFormats } from 'multi-llm-ts'

const plainTextFormats = ['txt', 'csv', 'json', 'yml', 'yaml', 'xml', 'html', 'css', 'md']

export default class Attachment extends AttachmentBase implements IAttachment{

  url: string
  extracted: boolean
  saved: boolean

  constructor(content: string, mimeType: string, url: string = '', saved: boolean = false, load: boolean = false) {
    super(content, mimeType)
    this.url = url
    this.saved = saved
    this.extracted = false
    if (load) {
      this.loadContents()
    }
  }

  get filename(): string {
    return this.url.split('/').pop() || 'unknown'
  }

  get filenameShort(): string {
    const fullname = this.filename
    let extension = fullname.includes('.') ? '.' + fullname.split('.').slice(-1) : ''
    let filename = extension.length ? fullname.split('.').slice(0, -1).join('.') : fullname
    if (filename.length > 12) {
      filename = filename.slice(0, 10) + '…'
      extension = extension.substring(1)
    }
    return filename + extension
  }

  loadContents(): void {

    // not if we already have
    if (this.content) {
      if (this.isText() && !this.extracted) {
        this.extractText()
      }
      return
    }

    // get contents
    if (!this.content && this.url) {
      this.content = window.api.file.read(this.url.replace('file://', ''))?.contents
    }

    // text formats
    if (this.content) {
      if (this.isText()) {
        this.extractText()
      }
    } 
  }

  b64Contents(): string {
    if (this.isText()) {
      return window.api.base64.encode(this.content)
    } else {
      return this.content
    }
  }

  static fromJson(obj: any): Attachment {
    return new Attachment(obj.content, obj.mimeType || extensionToMimeType(obj.format || ''), obj.url, obj.saved || obj.downloaded)
  }
  
  extractText(): void {

    // get text
    if (plainTextFormats.includes(this.format())) {
      this.content = window.api.base64.decode(this.content)
    } else {
      const rawText = window.api.file.extractText(this.content, this.format())
      this.mimeType = 'text/plain'
      this.content = rawText
    }

    // save
    this.extracted = true
  }

}
