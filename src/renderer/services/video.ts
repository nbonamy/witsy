
import { fal } from '@fal-ai/client'
import { GoogleGenAI, PersonGeneration } from '@google/genai'
import { xAIBaseURL } from 'multi-llm-ts'
import Replicate, { FileOutput } from 'replicate'
import { anyDict, MediaCreationEngine, MediaCreator, MediaReference } from 'types/index'
import { download, saveFileContents } from './download'
import { engineNames } from './llms/base'
import { store } from './store'

// Type definitions for OpenAI Video API
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type VideoModel = 'sora-2' | 'sora-2-pro'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type VideoSize = '720x1280' | '1280x720' | '1024x1792' | '1792x1024'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type VideoSeconds = '4' | '8' | '12'

interface VideoJob {
  id: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  progress?: number
  error?: {
    code: string
    message: string
  }
}

export default class VideoCreator implements MediaCreator {

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
    return engines
  }

  getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    return VideoCreator.getEngines(checkApiKey)
  }
   
  async execute(engine: string, model: string, parameters: anyDict, reference?: MediaReference[]): Promise<any> {
    if (engine === 'replicate') {
      return this.replicate(model, parameters)
    } else if (engine === 'falai') {
      return this.falai(model, parameters, reference)
    } else if (engine == 'google') {
      return this.google(model, parameters, reference)
    } else if (engine == 'openai') {
      return this.openai(model, parameters, reference)
    } else if (engine == 'xai') {
      return this.xai(model, parameters, reference)
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
  
  async falai(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

    try {

      // set api key
      fal.config({
        credentials: store.config.engines.falai.apiKey
      });

      // submit
      const response = await fal.subscribe(model, {
        input: {
          ...(parameters.prompt ? { prompt: parameters.prompt } : {}),
          ...(reference ? { image_url: `data:${reference[0].mimeType};base64,${reference[0].contents}` } : {}),
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
  async google(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

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

  async openai(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {
    return this._openai('openai', store.config.engines.openai.apiKey, store.config.engines.openai.baseURL, model, parameters, reference)
  }

  protected async _openai(name: string, apiKey: string, baseURL: string, model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

    try {
      const endpoint = baseURL || 'https://api.openai.com'

      // Step 1: Create video generation job
      console.log(`[${name}] creating video with model ${model}`)
      const formData = new FormData()
      formData.append('prompt', parameters?.prompt || '')
      formData.append('model', model)

      if (parameters?.size) {
        formData.append('size', parameters.size)
      }

      if (parameters?.seconds) {
        formData.append('seconds', parameters.seconds)
      }

      // Handle image reference if provided
      if (reference?.[0]) {
        const binaryString = atob(reference[0].contents)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: reference[0].mimeType })
        formData.append('input_reference', blob, 'reference.jpg')
      }

      const createResponse = await fetch(`${endpoint}/v1/videos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error(`[${name}] Video creation failed:`, errorText)
        throw new Error(`Video creation failed: ${createResponse.status} ${createResponse.statusText}`)
      }

      const videoJob: VideoJob = await createResponse.json()
      const videoId = videoJob.id

      if (!videoId) {
        throw new Error('Video API response missing id')
      }

      // Step 2: Poll for completion
      console.log(`[${name}] polling video status for ${videoId}`)
      const maxAttempts = 180 // 20-40 minutes with 10s intervals
      let currentJob = videoJob

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (currentJob.status === 'completed') {
          break
        }

        if (currentJob.status === 'failed') {
          console.error(`[${name}] Video generation failed`, currentJob.error)
          return {
            error: currentJob.error?.message || `Video generation failed with ${name} API`
          }
        }

        // Wait before next poll (10 seconds as recommended)
        await new Promise(resolve => setTimeout(resolve, 10000))

        const statusResponse = await fetch(`${endpoint}/v1/videos/${videoId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`)
        }

        currentJob = await statusResponse.json()

        if (currentJob.progress) {
          console.log(`[${name}] video generation progress: ${currentJob.progress}%`)
        }
      }

      if (currentJob.status !== 'completed') {
        throw new Error('Video generation timed out')
      }

      // Step 3: Download the video content
      console.log(`[${name}] downloading video content`)
      const downloadResponse = await fetch(`${endpoint}/v1/videos/${videoId}/content`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!downloadResponse.ok) {
        throw new Error(`Video download failed: ${downloadResponse.status} ${downloadResponse.statusText}`)
      }

      const blob = await downloadResponse.blob()
      const type = blob.type?.split('/')[1] || 'mp4'
      const b64 = await this.blobToBase64(blob)
      const content = b64.split(',')[1]
      const fileUrl = saveFileContents(type, content)

      return { url: fileUrl }

    } catch (error) {
      console.error(`[${name}] Video generation error:`, error)
      return { error: error.message || `Video generation failed with ${name} API` }
    }

  }

  async xai(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {

    const apiKey = store.config.engines.xai.apiKey

    try {

      // build body
      console.log(`[xai] creating video with model ${model}`)
      const body: anyDict = {
        model: model,
        prompt: parameters?.prompt,
      }

      // optional parameters
      if (parameters?.duration) body.duration = parameters.duration
      if (parameters?.aspect_ratio) body.aspect_ratio = parameters.aspect_ratio
      if (parameters?.resolution) body.resolution = parameters.resolution

      // reference for image-to-video or video editing
      const isEdit = reference?.length > 0
      if (reference?.[0]) {
        if (reference[0].mimeType.startsWith('video')) {
          body.video = { url: `data:${reference[0].mimeType};base64,${reference[0].contents}` }
        } else {
          body.image_url = `data:${reference[0].mimeType};base64,${reference[0].contents}`
        }
      }

      // Step 1: Submit generation/edit request
      const endpoint = isEdit ? 'videos/edits' : 'videos/generations'
      const createResponse = await fetch(`${xAIBaseURL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('[xai] Video creation failed:', errorText)
        throw new Error(`Video creation failed: ${createResponse.status} ${createResponse.statusText}`)
      }

      const createResult = await createResponse.json()
      const requestId = createResult.request_id

      if (!requestId) {
        throw new Error('xAI Video API response missing request_id')
      }

      // Step 2: Poll for completion
      console.log(`[xai] polling video status for ${requestId}`)
      const maxAttempts = 180
      for (let attempt = 0; attempt < maxAttempts; attempt++) {

        await new Promise(resolve => setTimeout(resolve, 10000))

        const statusResponse = await fetch(`${xAIBaseURL}/videos/${requestId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          }
        })

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`)
        }

        const statusResult = await statusResponse.json()

        // completed: video object is present with url
        if (statusResult.video?.url) {
          const fileUrl = download(statusResult.video.url)
          return { url: fileUrl }
        }

        // still pending
        if (statusResult.status === 'pending') {
          console.log(`[xai] video generation status: pending`)
          continue
        }

        // unexpected status
        console.log(`[xai] video generation status:`, JSON.stringify(statusResult))
      }

      throw new Error('Video generation timed out')

    } catch (error) {
      console.error('[xai] Video generation error:', error)
      return { error: error.message || 'Video generation failed with xAI API' }
    }
  }

  // SDK-BASED IMPLEMENTATION (commented out - kept for reference)
  // This version requires OpenAI SDK which is incompatible with Electron
  //
  // async openai(model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {
  //   return this._openai('openai', store.config.engines.openai.apiKey, store.config.engines.openai.baseURL, model, parameters, reference)
  // }
  //
  // protected async _openai(name: string, apiKey: string, baseURL: string, model: string, parameters: anyDict, reference?: MediaReference[]): Promise<anyDict> {
  //   // init
  //   const client = new OpenAI({
  //     apiKey: apiKey,
  //     baseURL: baseURL,
  //     dangerouslyAllowBrowser: true
  //   })
  //
  //   // call
  //   console.log(`[${name}] prompting model ${model}`)
  //   const video = await client.videos.create({
  //     model: model as VideoModel,
  //     prompt: parameters?.prompt,
  //     ...(parameters?.seconds ? { seconds: parameters.seconds } : {}),
  //     ...(parameters?.size ? { size: parameters.size } : {}),
  //   })
  //
  //   // poll for completion
  //   let videoJob = video
  //   while (videoJob.status === 'queued' || videoJob.status === 'in_progress') {
  //     await new Promise(resolve => setTimeout(resolve, 2000))
  //     videoJob = await client.videos.retrieve(video.id)
  //   }
  //
  //   // check for errors
  //   if (videoJob.status === 'failed') {
  //     console.error(`[${name}] Video generation failed`, videoJob.error)
  //     return { error: videoJob.error?.message || `Video generation failed with ${name} API` }
  //   }
  //
  //   // download the content
  //   const response = await client.videos.downloadContent(videoJob.id)
  //   const blob = await response.blob()
  //   const type = blob.type?.split('/')[1] || 'mp4'
  //   const b64 = await this.blobToBase64(blob)
  //   const content = b64.split(',')[1]
  //   const fileUrl = saveFileContents(type, content)
  //
  //   return { url: fileUrl }
  // }

  async blobToBase64(blob: Blob): Promise<string>{
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
  }
}
