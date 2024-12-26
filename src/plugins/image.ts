
import { anyDict } from 'types/index'
import { store } from '../services/store'
import { saveFileContents } from '../services/download'
import { PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import { HfInference } from '@huggingface/inference'
import Replicate, { FileOutput } from 'replicate'
import OpenAI from 'openai'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config?.enabled && (
      (this.config.engine == 'openai' && store.config?.engines.openai.apiKey != null) ||
      (this.config.engine == 'huggingface' && store.config?.engines.huggingface.apiKey != null) ||
      (this.config.engine == 'replicate' && store.config?.engines.replicate.apiKey != null)
    )
  }

  getName(): string {
    return 'image_generation'
  }

  getDescription(): string {
    return 'Generate an image based on a prompt. Returns the url of the image and a description of the image. Create only one image at a time unless explicitely asked to do otherwise. Always embed the image visible in the final response. Do not just include a link to the image.'
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }
      
  getRunningDescription(): string {
    return 'Painting pixels…'
  }

  getParameters(): PluginParameter[] {

    // every one has this
    const parameters: PluginParameter[] = [
      {
        name: 'prompt',
        type: 'string',
        description: 'The description of the image',
        required: true
      }
    ]

    // openai parameters
    if (this.config.engine == 'openai') {

      // rest depends on model
      if (store.config.engines.openai.model.image === 'dall-e-2') {

        parameters.push({
          name: 'size',
          type: 'string',
          enum: [ '256x256', '512x512', '1024x1024' ],
          description: 'The size of the image',
          required: false
        })

      } else if (store.config.engines.openai.model.image === 'dall-e-3') {

        parameters.push({
          name: 'quality',
          type: 'string',
          enum: [ 'standard', 'hd' ],
          description: 'The quality of the image',
          required: false
        })

        parameters.push({
          name: 'size',
          type: 'string',
          enum: [ '1024x1024', '1792x1024', '1024x1792' ],
          description: 'The size of the image',
          required: false
        })

        parameters.push({
          name: 'style',
          type: 'string',
          enum: ['vivid', 'natural'],
          description: 'The style of the image',
          required: false
        })

      }

    }

    // huggingface parameters
    if (this.config.engine == 'huggingface') {

      // parameters.push({
      //   name: 'negative_prompt',
      //   type: 'string',
      //   description: 'Stuff to avoid in the generated image',
      //   required: false
      // })

      // parameters.push({
      //   name: 'width',
      //   type: 'number',
      //   description: 'The width of the image',
      //   required: false
      // })

      // parameters.push({
      //   name: 'height',
      //   type: 'number',
      //   description: 'The height of the image',
      //   required: false
      // })

    }

    // done
    return parameters
  
  }

  async execute(parameters: anyDict): Promise<anyDict> {
    if (this.config.engine == 'openai') {
      return this.openai(parameters)
    } else if (this.config.engine == 'huggingface') {
      return this.huggingface(parameters)
    } else if (this.config.engine == 'replicate') {
      return this.replicate(parameters)
    } else {
      throw new Error('Unsupported engine')
    }
  }

  async openai(parameters: anyDict): Promise<anyDict> {

    // init
    const client = new OpenAI({
      apiKey: store.config.engines.openai.apiKey,
      dangerouslyAllowBrowser: true
    })

    // call
    const model = store.config.engines.openai.model.image
    console.log(`[openai] prompting model ${model}`)
    const response = await client.images.generate({
      model: model,
      prompt: parameters?.prompt,
      response_format: 'b64_json',
      size: parameters?.size,
      style: parameters?.style,
      quality: parameters?.quality,
      n: parameters?.n || 1,
    })

    // save the content on disk
    const fileUrl = saveFileContents('png', response.data[0].b64_json)
    //console.log('[image] saved image to', fileUrl)

    // return an object
    return {
      url: fileUrl,
      description: parameters?.prompt,
    }

  }  

  async huggingface(parameters: anyDict): Promise<anyDict> {

    // init
    const client = new HfInference(store.config.engines.huggingface.apiKey)

    // call
    const model = store.config.engines.huggingface.model.image
    console.log(`[huggingface] prompting model ${model}`)
    const blob: Blob = await client.textToImage({
      model: model,
      inputs: parameters?.prompt,
      parameters: {
        //negative_prompt: parameters?.negative_prompt,
        width: parameters?.width,
        height: parameters?.height
      }
    })

    // save the content on disk
    const b64 = await this.blobToBase64(blob)
    const type = blob.type?.split('/')[1] || 'jpg'
    const image = b64.split(',')[1]
    const fileUrl = saveFileContents(type, image)
    //console.log('[image] saved image to', fileUrl)

    // return an object
    return {
      url: fileUrl,
      description: parameters?.prompt
    }

  }  

  async replicate(parameters: any): Promise<any> {

    // init
    const client = new Replicate({ auth: store.config.engines.replicate.apiKey }); 

    // call
    const model = store.config.engines.replicate.model.image
    console.log(`[replicate] prompting model ${model}`)
    const output: FileOutput[] = await client.run(model as `${string}/${string}`, {
      input: {
        prompt: parameters?.prompt,
        output_format: 'jpg',
      }
    }) as FileOutput[];

    // save the content on disk
    const blob = Array.isArray(output) ? await output[0].blob() : await (output as FileOutput).blob()
    const type = blob.type?.split('/')[1] || 'jpg'
    const b64 = await this.blobToBase64(blob)
    const image = b64.split(',')[1]
    const fileUrl = saveFileContents(type, image)
    //console.log('[image] saved image to', fileUrl)

    // return an object
    return {
      url: fileUrl,
      description: parameters?.prompt
    }

  }
  
  async blobToBase64(blob: Blob): Promise<string>{
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
  }
}
