import { Model } from 'multi-llm-ts';
import { anyDict, MediaCreationEngine } from '../types/index';
import { saveFileContents } from '../services/download'
import { store } from '../services/store'
import { HfInference } from '@huggingface/inference'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Replicate, { FileOutput } from 'replicate'
import OpenAI from 'openai'
import SDWebUI from './sdwebui';

export default class ImageCreator {

  static getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    const engines = []
    if (!checkApiKey || store.config.engines.openai.apiKey) {
      engines.push({ id: 'openai', name: 'OpenAI' })
    }
    if (!checkApiKey || store.config.engines.replicate.apiKey) {
      engines.push({ id: 'replicate', name: 'Replicate' })
    }
    if (!checkApiKey || store.config.engines.google.apiKey) {
      engines.push({ id: 'google', name: 'Google' })
    }
    if (!checkApiKey || store.config.engines.huggingface.apiKey) {
      engines.push({ id: 'huggingface', name: 'HuggingFace' })
    }
    engines.push({ id: 'sdwebui', name: 'Stable Diffusion web UI' })
    return engines
  }

  static getModels(engine: string): Model[] {
    if (engine == 'huggingface') {
      return [
        'black-forest-labs/FLUX.1-schnell',
        'black-forest-labs/FLUX.1-dev',
        'dreamlike-art/dreamlike-photoreal-2.0',
        'prompthero/openjourney',
        'stabilityai/stable-diffusion-3.5-large-turbo',
      ].sort().map(name => ({ id: name, name }))
    } else if (engine == 'replicate') {
      return [
        'black-forest-labs/flux-1.1-pro',
        'black-forest-labs/flux-schnell',
        'ideogram-ai/ideogram-v2',
        'recraft-ai/recraft-v3-svg',
        'fofr/any-comfyui-workflow',
      ].sort().map(name => ({ id: name, name }))
    } else {
      return []
    }
  }

  getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    return ImageCreator.getEngines(checkApiKey)
  }

  getModels(engine: string): Model[] {
    return ImageCreator.getModels(engine)
  }

  async execute(engine: string, model: string, parameters: anyDict): Promise<anyDict> {
    if (engine == 'openai') {
      return this.openai(model, parameters)
    } else if (engine == 'huggingface') {
      return this.huggingface(model, parameters)
    } else if (engine == 'replicate') {
      return this.replicate(model, parameters)
    } else if (engine == 'sdwebui') {
      return this.sdwebui(model, parameters)
    } else if (engine == 'google') {
      return this.google(model, parameters)
    } else {
      throw new Error('Unsupported engine')
    }
  }

  async openai(model: string, parameters: anyDict): Promise<anyDict> {

    // init
    const client = new OpenAI({
      apiKey: store.config.engines.openai.apiKey,
      baseURL: store.config.engines.openai.baseURL,
      dangerouslyAllowBrowser: true
    })

    // call
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
    }

  }  

  async huggingface(model: string, parameters: anyDict): Promise<anyDict> {

    // init
    const client = new HfInference(store.config.engines.huggingface.apiKey)

    // call
    console.log(`[huggingface] prompting model ${model}`)
    const { prompt, ...otherParameters } = parameters;
    const blob: Blob = await client.textToImage({
      model: model,
      inputs: prompt,
      parameters: otherParameters,
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
    }

  }  

  async replicate(model: string, parameters: any): Promise<any> {

    // init
    const client = new Replicate({ auth: store.config.engines.replicate.apiKey }); 

    // call
    console.log(`[replicate] prompting model ${model}`)
    const output: FileOutput[] = await client.run(model as `${string}/${string}`, {
      input: {
        ...parameters,
        output_format: 'jpg',
      }
    }) as FileOutput[];

    // save the content on disk
    const blob = Array.isArray(output) ? await output[0].blob() : await (output as FileOutput).blob()
    const type = blob.type?.split('/')[1] || 'jpg'
    const b64 = await this.blobToBase64(blob)
    const image = b64.split(',')[1]
    const fileUrl = saveFileContents(type === 'svg+xml' ? 'svg' : type, image)
    //console.log('[image] saved image to', fileUrl)

    // return an object
    return {
      url: fileUrl,
    }

  }

  async sdwebui(model: string, parameters: anyDict): Promise<anyDict> {

    const client = new SDWebUI(store.config)
    const response = await client.generateImage(model, parameters.prompt, parameters)
 
    // save the content on disk
    const fileUrl = saveFileContents('png', response.images[0])
    //console.log('[image] saved image to', fileUrl)

    // return an object
    return {
      url: fileUrl,
    }
    
  }

  // monitor https://github.com/googleapis/js-genai
  async google(model: string, parameters: anyDict): Promise<anyDict> {

    const client = new GoogleGenerativeAI(store.config.engines.google.apiKey)
  
    const generativeModel = client.getGenerativeModel({
      model: model,
      generationConfig: {
        // @ts-expect-error google
        responseModalities: ['Text', 'Image']
      },
    });

    try {
      const response = await generativeModel.generateContent(parameters.prompt);
      for (const part of  response.response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const fileUrl = saveFileContents('png', imageData)
          return {
            url: fileUrl,
          }
        }
      }
    } catch (error) {
      console.error("Error generating content:", error);
    }

    return { 
      error: 'Failed to generate image with Google Generative AI'
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