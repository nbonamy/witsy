
import { Attachment as IAttachment } from 'types'
import { Attachment as AttachmentBase, extensionToMimeType } from 'multi-llm-ts'

export { textFormats } from 'multi-llm-ts'
export { imageFormats } from 'multi-llm-ts'

export const parseableTextFormats = [
  'pdf', 'docx', 'pptx', 'xlsx'
]

export default class Attachment extends AttachmentBase implements IAttachment{

  url: string
  filepath: string
  extracted: boolean
  saved: boolean

  constructor(content: string, mimeType: string, url: string = '', saved: boolean = false) {
    super(content, mimeType)
    this.url = url
    this.filepath = url
    this.saved = saved
    this.extracted = false
  }

  static async load(content: string, mimeType: string, url: string = '', saved: boolean = false): Promise<Attachment> {
    const attachment = new Attachment(content, mimeType, url, saved)
    await attachment.loadContents()
    return attachment
  }

  get filename(): string {
    if (this.filepath) return this.filepath.split('/').pop()
    else if (this.url) return this.url.split('/').pop()
    else return 'unknown'
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

  async loadContents(): Promise<void> {

    // not if we already have
    if (this.content) {
      if (this.isText() && !this.extracted) {
        await this.extractText()
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
        await this.extractText()
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
    const attachment = new Attachment(obj.content, obj.mimeType || extensionToMimeType(obj.format || ''), obj.url, obj.saved || obj.downloaded)
    attachment.filepath = obj.filepath || ''
    return attachment
  }
  
  async extractText(): Promise<void> {

    // get text
    if (parseableTextFormats.includes(this.format())) {

      try {
        this.content = await window.api.file.extractText(this.content, this.format())
      } catch (e) {
        if (this.saved) {
          this.content = await window.api.file.extractText(this.content, 'txt')
        } else {
          throw e;
        }
      }
    } else {
      this.content = window.api.base64.decode(this.content)
    }

    // save
    this.extracted = true
  }

  isText(): boolean {
    return super.isText() || parseableTextFormats.includes(this.format())
  }
}
