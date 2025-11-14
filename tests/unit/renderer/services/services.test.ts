
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../../../src/renderer/services/store'
import Falai from '../../../../src/renderer/services/falai'
import HuggingFace from '../../../../src/renderer/services/huggingface'
import Replicate from '../../../../src/renderer/services/replicate'

let falai_call = 0

// @ts-expect-error mocking
global.fetch = async (url: string) => {

  if (url.includes('fal.ai')) {
    if (falai_call++ > 4) {
      throw new Error('Fal.ai called more than once')
    }
    const category = url.split('=')[1]
    return {
      text: () => `<script>push([{\\"models\\":[{\\"id\\":\\"${category}/model1\\"},{\\"id\\":\\"${category}/model2\\"}],\\"filter)</script>`
    }
  }

  if (url.includes('replicate')) {
    const collection = url.split('/').pop()
    return {
      ok: true,
      json: () => ({
        models: [
          { owner: collection, name: 'model1', latest_version: { id: 'v1' } },
          { owner: collection, name: 'model2' },
        ]
      })
    }
  }

}

vi.mock('@huggingface/hub', () => {
  return {
    listModels: vi.fn((async (args: any) => {
      return [
        { name: `${args.search.task}/model1` },
        { name: `${args.search.task}/model2` },
      ]
    }))
  }

})


beforeEach(() => {
  vi.resetAllMocks()
  store.config = {
    engines: {
      falai: {
        models: {}
      },
      huggingface: {
        models: {}
      },
      replicate: {
        models: {}
      }
    }
  }
})

test('Load Fal.ai Models', async () => {
  const falai = new Falai(store.config)
  expect(await falai.loadModels()).toBe(true)
  expect(store.config.engines.falai.models.image).toStrictEqual([
    { id: 'text-to-image/model1', name: 'text-to-image/model1' },
    { id: 'text-to-image/model2', name: 'text-to-image/model2' },
  ])
  expect(store.config.engines.falai.models.imageEdit).toStrictEqual([
    { id: 'image-to-image/model1', name: 'image-to-image/model1' },
    { id: 'image-to-image/model2', name: 'image-to-image/model2' },
  ])
  expect(store.config.engines.falai.models.video).toStrictEqual([
    { id: 'text-to-video/model1', name: 'text-to-video/model1' },
    { id: 'text-to-video/model2', name: 'text-to-video/model2' },
  ])
  expect(store.config.engines.falai.models.videoEdit).toStrictEqual([
    { id: 'video-to-video/model1', name: 'video-to-video/model1' },
    { id: 'video-to-video/model2', name: 'video-to-video/model2' },
  ])
})

test('Load Fal.ai Models Error', async () => {
  const falai = new Falai(store.config)
  expect(await falai.loadModels()).toBe(true)
  expect(store.config.engines.falai.models.image.length).toBeGreaterThan(0)
  expect(store.config.engines.falai.models.imageEdit).toHaveLength(0)
  expect(store.config.engines.falai.models.video.length).toBeGreaterThan(0)
  expect(store.config.engines.falai.models.videoEdit).toHaveLength(0)
})

test('Load HuggingFace Models', async () => {
  const huggingface = new HuggingFace(store.config)
  expect(await huggingface.loadModels()).toBe(true)
  expect(store.config.engines.huggingface.models.image).toStrictEqual([
    { id: 'text-to-image/model1', name: 'text-to-image/model1' },
    { id: 'text-to-image/model2', name: 'text-to-image/model2' },
  ])
  expect(store.config.engines.huggingface.models.imageEdit).toStrictEqual([
    { id: 'image-to-image/model1', name: 'image-to-image/model1' },
    { id: 'image-to-image/model2', name: 'image-to-image/model2' },
  ])
  expect(store.config.engines.huggingface.models.video).toStrictEqual([
    { id: 'text-to-video/model1', name: 'text-to-video/model1' },
    { id: 'text-to-video/model2', name: 'text-to-video/model2' },
  ])
  expect(store.config.engines.huggingface.models.videoEdit).toStrictEqual([
    // { id: 'video-to-video/model1', name: 'video-to-video/model1' },
    // { id: 'video-to-video/model2', name: 'video-to-video/model2' },
  ])
})

test('Load Replicate Models', async () => {
  const replicate = new Replicate(store.config)
  expect(await replicate.loadModels()).toBe(true)
  expect(store.config.engines.replicate.models.image).toStrictEqual([
    { id: 'text-to-image/model1', name: 'text-to-image/model1', meta: { version: 'v1' } },
    { id: 'text-to-image/model2', name: 'text-to-image/model2' },
  ])
  expect(store.config.engines.replicate.models.imageEdit).toStrictEqual([
    { id: 'image-editing/model1', name: 'image-editing/model1', meta: { version: 'v1' } },
    { id: 'image-editing/model2', name: 'image-editing/model2' },
  ])
  expect(store.config.engines.replicate.models.video).toStrictEqual([
    { id: 'text-to-video/model1', name: 'text-to-video/model1', meta: { version: 'v1' } },
    { id: 'text-to-video/model2', name: 'text-to-video/model2' },
  ])
  expect(store.config.engines.replicate.models.videoEdit).toStrictEqual([
    { id: 'ai-enhance-videos/model1', name: 'ai-enhance-videos/model1', meta: { version: 'v1' } },
    { id: 'ai-enhance-videos/model2', name: 'ai-enhance-videos/model2' },
  ])
})
