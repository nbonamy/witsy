
export default class {

  constructor(config) {
    this.config = config
  }

  _buildMessages(thread) {
    if (typeof thread === 'string') {
      return [{ role: 'user', content: thread }]
    } else {
      return thread.filter((msg) => msg.type === 'text' && msg.content !== null).map((msg) => {
        return { role: msg.role, content: msg.content }
      })
    }
  }

}
