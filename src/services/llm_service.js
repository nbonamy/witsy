
export default class {

  constructor(config) {
    this.config = config
  }

  _buildMessages(thread) {
    if (typeof thread === 'string') {
      return [{ role: 'user', content: thread }]
    } else {
      return thread.filter((msg) => msg.type === 'text' && msg.content !== null).map((msg) => {
        let message = { role: msg.role, content: msg.content }
        if (msg.attachment && this.hasVision()) {
          message.content = [
            { type: 'text', text: msg.content },
            { type: 'image_url', image_url: {
              url: 'data:image/jpeg;base64,' + msg.attachment.contents,
            }}
          ]
        }
        return message
      })
    }
  }

}
