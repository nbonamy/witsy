
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '../../../../src/renderer/services/store'
import SDWebUI from '../../../../src/renderer/services/sdwebui'

// @ts-expect-error mocking
global.fetch = async (url: string) => {
  if (url.includes('models')) {
    return {
      json: () => ([
        { title: 'model1', model_name: 'Model 1' },
        { title: 'model2', model_name: 'Model 2' },
      ])
    }
  }
  if (url.includes('txt2img')) {
    return {
      json: () => ({ images: [ 'data:image/png;base64,IMAGE_DATA', ] }) }
  }
}

beforeAll(() => {
  store.config = {
    engines: {
      sdwebui: {
        models: {}
      }
    }
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

test('Load Models', async () => {
  const sdwebui = new SDWebUI(store.config)
  expect(await sdwebui.getModels()).toStrictEqual([
    { id: 'model1', name: 'Model 1', meta: { title: 'model1', model_name: 'Model 1' } },
    { id: 'model2', name: 'Model 2', meta: { title: 'model2', model_name: 'Model 2' } },
  ])
  expect(await sdwebui.loadModels()).toBe(true)
  expect(store.config.engines.sdwebui.models.image.length).toBe(2)
})

test('Generates Image', async () => {
  const sdwebui = new SDWebUI(store.config)
  expect(await sdwebui.generateImage('model1', 'prompt', { steps: 20 })).toStrictEqual(
    { images: [ 'data:image/png;base64,IMAGE_DATA', ] }
  )
})
