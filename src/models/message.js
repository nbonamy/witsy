
export default class Message {

  constructor(role, obj) {
    this.createdAt = new Date()
    this.role = role
    this.attachment = null
    this.type = 'unknown'
    if (typeof obj === 'string') {
      this.setText(obj)
    } else if (typeof obj === 'object') {
      this.type = obj.type
      this.content = obj.content
    }
  }

  setText(text) {
    this.type = 'text'
    this.content = text
  }

  setImage(url) {
    this.type = 'image'
    this.content = url
  }

  appendText(chunk) {
    if (this.type === 'text') {
      if (!this.content) this.content = ''
      this.content = this.content + chunk
    }
  }

  attachFile(file) {
    this.attachment = file
  }

}
