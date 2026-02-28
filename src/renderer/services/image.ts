
import { fal } from '@fal-ai/client'
import { GenerateContentResponse, GoogleGenAI, PersonGeneration, SafetyFilterLevel, SubjectReferenceImage } from '@google/genai'
import { HfInference } from '@huggingface/inference'
import { ModelGoogle, xAIBaseURL } from 'multi-llm-ts'
import OpenAI, { toFile } from 'openai'
import Replicate, { FileOutput } from 'replicate'
import { anyDict, MediaCreationEngine, MediaCreator, MediaReference } from 'types/index'
import { download, saveFileContents } from './download'
import { engineNames } from './llms/base'
import SDWebUI from './sdwebui'
import { store } from './store'

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
    engines.push({ id: 'ollama', name: engineNames.ollama })
    engines.push({ id: 'sdwebui', name: engineNames.sdwebui })
    return engines
  }

  getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    return ImageCreator.getEngines(checkApiKey)
  }

  async execute(engine: string, model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {
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
      return this.xai(model, parameters, reference)
    } else if (engine == 'ollama') {
      return this.ollama(model, parameters)
    } else {
      throw new Error('Unsupported engine')
    }
  }

  async openai(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {
    return this._openai('openai', store.config.engines.openai.apiKey, store.config.engines.openai.baseURL, model, parameters, reference)
  }

  async xai(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

    const apiKey = store.config.engines.xai.apiKey

    try {

      // build body
      console.log(`[xai] prompting model ${model}`)
      const isEdit = reference?.length > 0
      const body: anyDict = {
        model: model,
        prompt: parameters?.prompt,
        n: parameters?.n || 1,
      }

      // reference images for editing
      if (reference?.length === 1) {
        body.image = { url: `data:${reference[0].mimeType};base64,${reference[0].contents}`, type: 'image_url' }
      } else if (reference?.length > 1) {
        body.images = reference.map(r => ({ url: `data:${r.mimeType};base64,${r.contents}`, type: 'image_url' }))
      }

      // call - edits use a different endpoint
      const endpoint = isEdit ? 'images/edits' : 'images/generations'
      const response = await fetch(`${xAIBaseURL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[xai] Image generation failed:', errorText)
        throw new Error(`Image generation failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      // save the content on disk
      if (result.data?.[0]?.b64_json) {
        const fileUrl = saveFileContents('png', result.data[0].b64_json)
        return { url: fileUrl }
      } else if (result.data?.[0]?.url) {
        const fileUrl = download(result.data[0].url)
        return { url: fileUrl }
      } else {
        console.error('[xai] No image returned', result)
        return { error: 'No image returned from xAI API' }
      }

    } catch (error) {
      console.error('[xai] Image generation error:', error)
      return { error: error.message || 'Image generation failed with xAI API' }
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

  async replicate(model: string, parameters: any/*, reference?: MediaReference[]*/): Promise<any> {

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

  async ollama(model: string, parameters: anyDict): Promise<anyDict> {

    const baseURL = store.config.engines.ollama.baseURL || 'http://127.0.0.1:11434'

    try {

      // call
      console.log(`[ollama] prompting model ${model}`)
      const response = await fetch(`${baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: parameters.prompt,
          stream: false,
          ...(parameters.width ? { width: parameters.width } : {}),
          ...(parameters.height ? { height: parameters.height } : {}),
          ...(parameters.steps ? { steps: parameters.steps } : {}),
        })
      })

      const json = await response.json()

      // check for error
      if (json.error) {
        console.error('[ollama] Error generating image:', json.error)
        return { error: json.error }
      }

      // check for image
      if (!json.image) {
        console.error('[ollama] No image returned')
        return { error: 'No image returned from Ollama' }
      }

      // save the content on disk
      const fileUrl = saveFileContents('png', json.image)
      return { url: fileUrl }

    } catch (error) {
      console.error('[ollama] Error generating image:', error)
      return { error: error.message }
    }

  }

  async google(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

    let api: 'image' | 'text' = 'image'

    const googleModel = store.config.engines.google?.models?.image?.find((m: any) => m.id === model)
    if (googleModel && googleModel.meta) {
      const meta = googleModel.meta as ModelGoogle
      if (!meta.supportedActions.includes('predict')) {
        api = 'text'
      }
    }

    if (api == 'text') {
      return this.google_text(model, parameters, reference)
    } else {
      return this.google_image(model, parameters, reference)
    }

  }

  async google_text(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

    const client = new GoogleGenAI({ apiKey: store.config.engines.google.apiKey })

    try {

      let response: GenerateContentResponse = null

      if (!reference) {
  
        response = await client.models.generateContent({
          model: model,
          contents: parameters.prompt,
        });

      } else {

        response = await client.models.generateContent({
          model: model,
          contents: [
            { text: parameters.prompt, },
            ...reference.map(r => ({ inlineData: {
              mimeType: r.mimeType,
              data: r.contents,
            }}))
          ]
        });

      }

      // iterate on parts
      for (const part of response.candidates[0].content.parts || []) {
        if (part.text) {
          console.log(`[google] image generation with ${model}`, part.text)
        } else if (part.inlineData) {
          const imageData = part.inlineData.data;
          const fileUrl = saveFileContents('png', imageData)
          return {
            url: fileUrl,
          }
        }
      }

      // error
      throw new Error('No inline data found')

    } catch (error) {
      console.error("Error generating content:", error);
    }

    return { 
      error: 'Failed to generate image with Google Generative AI'
    }
  
  }

  async google_image(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

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
            personGeneration: PersonGeneration.ALLOW_ADULT,
            includeRaiReason: true,
          },
        });

      } else {

        let referenceId = 1
        const referenceImages = reference.map(r => {
          const referenceImage = new SubjectReferenceImage()
          referenceImage.referenceId = referenceId++
          referenceImage.referenceImage = {
            imageBytes: r.contents,
            mimeType: r.mimeType,
          }
          return referenceImage
        })

        response = await client.models.editImage({
          model: model,
          prompt: parameters.prompt,
          referenceImages: referenceImages,
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

  async falai(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

    try {

      // set api key
      fal.config({
        credentials: store.config.engines.falai.apiKey
      });

      // submit
      const response = await fal.subscribe(model, {
        input: {
          ...parameters,
          ...(reference ? { image_url: `data:${reference[0].mimeType};base64,${reference[0].contents}` } : {}),
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

  protected async _openai(name: string, apiKey: string, baseURL: string, model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

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
      const binaryString = atob(reference[0].contents);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // now submit
      response = await client.images.edit({
        model: model,
        prompt: parameters?.prompt,
        image: await toFile(bytes, '', { type: reference[0].mimeType }),
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