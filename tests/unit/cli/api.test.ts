import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { WitsyAPI } from '../../../src/cli/api'
import { state } from '../../../src/cli/state'

// Setup fetch mock
global.fetch = vi.fn()

describe('WitsyAPI', () => {
  let api: WitsyAPI

  beforeEach(() => {
    api = new WitsyAPI()
    state.port = 4321
    state.engine = 'openai'
    state.model = 'gpt-4'
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('getConfig makes correct API call', async () => {
    const mockResponse = {
      engine: 'openai',
      model: 'gpt-4',
      userDataPath: '/path/to/userData',
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await api.getConfig()

    expect(fetch).toHaveBeenCalledWith('http://localhost:4321/api/cli/config')
    expect(result).toEqual(mockResponse)
  })

  test('getEngines makes correct API call', async () => {
    const mockResponse = {
      engines: [
        { id: 'openai', name: 'OpenAI' },
        { id: 'anthropic', name: 'Anthropic' },
      ],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await api.getEngines()

    expect(fetch).toHaveBeenCalledWith('http://localhost:4321/api/engines')
    expect(result).toEqual(mockResponse.engines)
  })

  test('getModels makes correct API call', async () => {
    const mockResponse = {
      models: [
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      ],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await api.getModels('openai')

    expect(fetch).toHaveBeenCalledWith('http://localhost:4321/api/models/openai')
    expect(result).toEqual(mockResponse.models)
  })

  test('handles HTTP errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    await expect(api.getConfig()).rejects.toThrow('HTTP 404')
  })
})
