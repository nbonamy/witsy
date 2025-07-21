
import { xAIBaseURL } from 'multi-llm-ts'
import { anyDict, MediaCreationEngine, MediaReference, MediaCreator } from '../types/index'
import { saveFileContents, download } from '../services/download'
import { engineNames } from '../llms/base'
import { store } from '../services/store'
import { HfInference } from '@huggingface/inference'
import { GoogleGenAI, PersonGeneration, SafetyFilterLevel, SubjectReferenceImage } from '@google/genai'
import Replicate, { FileOutput } from 'replicate'
import { fal } from '@fal-ai/client'
import OpenAI, { toFile } from 'openai'
import SDWebUI from './sdwebui'

export default class ImageCreator implements MediaCreator {

  static getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    const engines = []
    if (!checkApiKey || store.config.engines.openai.apiKey) {
      engines.push({ id: 'openai', name: engineNames.openai })
    }
    if (!checkApiKey || store.config.engines.google.apiKey) {
      engines.push({ id: 'google', name: engineNames.google })
    }
    if (!checkApiKey || store.config.engines.xai.apiKey) {
      engines.push({ id: 'xai', name: engineNames.xai })
    }
    if (!checkApiKey || store.config.engines.replicate.apiKey) {
      engines.push({ id: 'replicate', name: engineNames.replicate })
    }
    if (!checkApiKey || store.config.engines.falai.apiKey) {
      engines.push({ id: 'falai', name: engineNames.falai })
    }
    if (!checkApiKey || store.config.engines.huggingface.apiKey) {
      engines.push({ id: 'huggingface', name: engineNames.huggingface })
    }
    engines.push({ id: 'sdwebui', name: engineNames.sdwebui })
    return engines
  }

  getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    return ImageCreator.getEngines(checkApiKey)
  }

  async execute(engine: string, model: string, parameters: anyDict, reference?: MediaReference): Promise<anyDict> {
    if (engine == 'openai') {
      return this.openai(model, parameters, reference)
    } else if (engine == 'huggingface') {
      return this.huggingface(model, parameters)
    } else if (engine == 'replicate') {
      return this.replicate(model, parameters)
    } else if (engine == 'sdwebui') {
      return this.sdwebui(model, parameters)
    } else if (engine == 'google') {
      return this.google(model, parameters, reference)
    } else if (engine == 'falai') {
      return this.falai(model, parameters, reference)
    } else if (engine == 'xai') {
      return this.xai(model, parameters)
    } else {
      throw new Error('Unsupported engine')
    }
  }

  async openai(model: string, parameters: anyDict, reference?: MediaReference): Promise<anyDict> {
    return this._openai('openai', store.config.engines.openai.apiKey, store.config.engines.openai.baseURL, model, parameters, reference)
  }

  async xai(model: string, parameters: anyDict): Promise<anyDict> {
    return this._openai('xai', store.config.engines.xai.apiKey, xAIBaseURL, model, parameters)
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

  async replicate(model: string, parameters: any/*, reference?: MediaReference*/): Promise<any> {

    // init
    const client = new Replicate({ auth: store.config.engines.replicate.apiKey });

    // check if we know a version
    const m = store.config.engines.replicate?.models?.image?.find((m: any) => m.id === model)
    // @ts-expect-error not standard meta
    if (m?.meta?.version) {
      // @ts-expect-error not standard meta
      model = `${model}:${m.meta.version}`
    }


    // call
    console.log(`[replicate] prompting model ${model}`)
    const output: FileOutput[] = await client.run(model as `${string}/${string}`, {
      input: {
        ...parameters,
        //...(reference ? { img: `data:${reference.mimeType};base64,${reference.contents}` } : {}),
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

  async google(model: string, parameters: anyDict, reference?: MediaReference): Promise<anyDict> {

    const client = new GoogleGenAI({ apiKey: store.config.engines.google.apiKey })
  
    try {

      let response = null

      if (!reference) {
  
        response = await client.models.generateImages({
          model: model,
          prompt: parameters.prompt,
          config: {
            numberOfImages: 1,
            //safetyFilterLevel: SafetyFilterLevel.BLOCK_NONE,
            personGeneration: PersonGeneration.ALLOW_ALL,
            includeRaiReason: true,
          },
        });

      } else {

        const referenceImage = new SubjectReferenceImage()
        referenceImage.referenceId = 1
        referenceImage.referenceImage = {
          imageBytes: reference.contents,
          mimeType: reference.mimeType,
        }

        response = await client.models.editImage({
          model: model,
          prompt: parameters.prompt,
          referenceImages: [referenceImage],
          config: {
            numberOfImages: 1,
            safetyFilterLevel: SafetyFilterLevel.BLOCK_NONE,
            personGeneration: PersonGeneration.ALLOW_ALL,
            includeRaiReason: true,
          },
        });

      }

      // if (response.promptFeedback?.blockReason) {
      //   return { 
      //     error: `Google Generative AI blocked the request: ${response.promptFeedback.blockReason}`
      //   }
      // }

      // if no image was generated, return an error
      if (!response.generatedImages?.[0]?.image) {
        if (response.generatedImages?.[0]?.raiFilteredReason) {
          return { 
            error: `Google Generative AI finished with reason: ${response.generatedImages[0].raiFilteredReason}`
          }
        }
        return { 
          error: 'Google Generative AI returned no content'
        }
      }

      // save the content and return
      const imageData = response.generatedImages[0].image.imageBytes
      const fileUrl = saveFileContents('png', imageData)
      return {
        url: fileUrl,
      }

    } catch (error) {
      console.error("Error generating content:", error);
    }

    return { 
      error: 'Failed to generate image with Google Generative AI'
    }

  }

  async falai(model: string, parameters: anyDict, reference?: MediaReference): Promise<anyDict> {

    try {

      // set api key
      fal.config({
        credentials: store.config.engines.falai.apiKey
      });

      // submit
      const response = await fal.subscribe(model, {
        input: {
          ...parameters,
          ...(reference ? { image_url: `data:${reference.mimeType};base64,${reference.contents}` } : {}),
        }
      })

      // download
      const image = response.data.images?.[0] || response.data.image
      const fileUrl = download(image.url)
      return { url: fileUrl }

    } catch (error) {
      console.error("Error generating content:", error);
      return { error: error.message }
    }
  
  }

  protected async _openai(name: string, apiKey: string, baseURL: string, model: string, parameters: anyDict, reference?: MediaReference): Promise<anyDict> {

    // init
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
      dangerouslyAllowBrowser: true
    })

    // call
    console.log(`[${name}] prompting model ${model}`)
    let response = null
    if (reference) {

      // we need the binary data
      const binaryString = atob(reference.contents);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // now submit
      response = await client.images.edit({
        model: model,
        prompt: parameters?.prompt,
        image: await toFile(bytes, '', { type: reference.mimeType }),
      })

    } else {
      
      response = await client.images.generate({
        model: model,
        prompt: parameters?.prompt,
        response_format: model.includes('dall-e') ? 'b64_json' : undefined,
        size: parameters?.size,
        style: parameters?.style,
        quality: parameters?.quality,
        n: parameters?.n || 1,
      })
    
    }

    // save the content on disk
    if (response.data[0].b64_json) {
      const fileUrl = saveFileContents('png', response.data[0].b64_json)
      //console.log('[image] saved image to', fileUrl)
      return { url: fileUrl }
    } else if (response.data[0].url) {
      const fileUrl = download(response.data[0].url)
      //console.log('[image] downloaded image from', fileUrl)
      return { url: fileUrl }
    } else {
      console.error(`[${name}] No image returned from OpenAI API`, response)
      return { error: `No image returned from ${name} API` }
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