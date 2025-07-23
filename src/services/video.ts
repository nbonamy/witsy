
import { anyDict, MediaCreator, MediaCreationEngine, MediaReference } from '../types/index'
import { saveFileContents, download } from '../services/download'
import { engineNames } from '../llms/base'
import { store } from '../services/store'
import Replicate, { FileOutput } from 'replicate'
import { GoogleGenAI, PersonGeneration } from '@google/genai'
import { fal } from '@fal-ai/client'

export default class VideoCreator implements MediaCreator {

  static getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    const engines = []
    if (!checkApiKey || store.config.engines.google.apiKey) {
      engines.push({ id: 'google', name: engineNames.google })
    }
    if (!checkApiKey || store.config.engines.replicate.apiKey) {
      engines.push({ id: 'replicate', name: engineNames.replicate })
    }
    if (!checkApiKey || store.config.engines.falai.apiKey) {
      engines.push({ id: 'falai', name: engineNames.falai })
    }
    return engines
  }

  getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    return VideoCreator.getEngines(checkApiKey)
  }
   
  async execute(engine: string, model: string, parameters: anyDict, reference?: MediaReference): Promise<any> {
    if (engine === 'replicate') {
      return this.replicate(model, parameters)
    } else if (engine === 'falai') {
      return this.falai(model, parameters, reference)
    } else if (engine == 'google') {
      return this.google(model, parameters, reference)
    } else {
      throw new Error('Unsupported engine')
    }
  }

  async replicate(model: string, parameters: anyDict): Promise<any> {

    // init
    const client = new Replicate({ auth: store.config.engines.replicate.apiKey }); 

    // call
    console.log(`[replicate] prompting model ${model}`)
    const output: FileOutput[] = await client.run(model as `${string}/${string}`, {
      input: parameters,
    }) as FileOutput[];

    // save the content on disk
    const blob = Array.isArray(output) ? await output[0].blob() : await (output as FileOutput).blob()
    const type = blob.type?.split('/')[1] || 'mp4'
    const b64 = await this.blobToBase64(blob)
    const image = b64.split(',')[1]
    const fileUrl = saveFileContents(type, image)
    //console.log('[image] saved image to', fileUrl)

    // return an object
    return {
      url: fileUrl,
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
          ...(parameters.prompt ? { prompt: parameters.prompt } : {}),
          ...(reference ? { image_url: `data:${reference.mimeType};base64,${reference.contents}` } : {}),
        }
      })

      // download
      const video = response.data.video
      const fileUrl = download(video.url)
      return { url: fileUrl }

    } catch (error) {
      console.error("Error generating content:", error);
      return { error: error.message }
    }
  
  }
     
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async google(model: string, parameters: anyDict, reference?: MediaReference): Promise<anyDict> {

    const client = new GoogleGenAI({ apiKey: store.config.engines.google.apiKey })
  
    try {

      let operation = await client.models.generateVideos({
        model: model,
        prompt: parameters.prompt,
        // ...(reference && reference.mimeType.startsWith('image') ? { image: { imageBytes: reference.contents } } : {}),
        // ...(reference && reference.mimeType.startsWith('video') ? { video: { videoBytes: reference.contents } } : {}),
        config: {
          numberOfVideos: 1,
          //safetyFilterLevel: SafetyFilterLevel.BLOCK_NONE,
          personGeneration: PersonGeneration.ALLOW_ALL,
        },
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 2500))
        operation = await client.operations.getVideosOperation({operation: operation})
      }

      // if no video was generated, return an error
      if (!operation?.response?.generatedVideos?.[0]?.video) {
        if (operation?.response?.raiMediaFilteredReasons) {
          return { 
            error: `Google Generative AI finished with reason: ${operation.response.raiMediaFilteredReasons[0]}`
          }
        }
        return { 
          error: 'Google Generative AI returned no content'
        }
      }

      // save the content and return
      const videoUrl = operation.response.generatedVideos[0].video.uri
      const mimeType = operation.response.generatedVideos[0].video.mimeType || 'video/mp4'
      const fileUrl = await window.api.google.downloadMedia(videoUrl, mimeType)
      return { url: fileUrl, }

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
