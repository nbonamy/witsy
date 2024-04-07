
export default class {

  constructor(config) {
    this.config = config
  }

  _isVisionModel(model) {
    return false
  }

  _requiresVisionModel(thread, currentModel) {
    
    // if we already have a vision or auto switch is disabled
    if (this._isVisionModel(currentModel) || !this.config.llm.autoVisionSwitch) {
      return false
    }

    // check if amy of the messages in the thread have an attachment
    return thread.some((msg) => msg.attachment)

  }

  _findModel(models, filters) {
    for (let filter of filters) {
      if (filter.startsWith('*')) {
        let matches = models.filter((m) => !m.id.includes(match.substring(1)))
        if (matches.length > 0) return matches[0]
      } else {
        let model = models.find((m) => m.id == filter)
        if (model) return model
      }
    }
    return null
  }

  _buildPayload(thread, model) {
    if (typeof thread === 'string') {
      return [{ role: 'user', content: thread }]
    } else {
      return thread.filter((msg) => msg.type === 'text' && msg.content !== null).map((msg) => {
        let payload = { role: msg.role, content: msg.content }
        if (msg.attachment && this._isVisionModel(model)) {
          this.addImageToPayload(msg, payload)
        }
        return payload
      })
    }
  }

}
