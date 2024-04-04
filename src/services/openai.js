import OpenAI from 'openai'

export default class {

  constructor(config) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.openAI.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  async getModels() {
    try {
      const response = await this.client.models.list()
      return response.data
    } catch (error) {
      console.error("Error listing models:", error);
    }
  }

  async complete(thread, opts) {

    // call
    const response = await this.client.chat.completions.create({
      model: opts?.model || this.config.openAI.models.chat,
      messages: this._buildMessages(thread),
    });

    // return an object
    return {
      type: 'text',
      content: response.choices[0].message.content
    }
  }

  async stream(thread) {
    return this.client.chat.completions.create({
      model: this.config.openAI.models.chat,
      messages: this._buildMessages(thread),
      stream: true,
    })
  }

  async image(prompt) {
    
    // call
    const response = await this.client.images.generate({
      model: this.config.openAI.models.image,
      prompt: prompt,
      n:1,
    })
    
    // return an object
    return {
      type: 'image',
      original_prompt: prompt,
      revised_prompt: response.data[0].revised_prompt,
      url: response.data[0].url,
    }

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
