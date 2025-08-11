
import { vi, beforeAll, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import * as main from '../../src/main/experts'
import * as service from '../../src/services/experts'
import { app } from 'electron'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: vi.fn(() => '')
    },
  }
})

vi.mock('fs', async (importOriginal) => {
  const mod: any = await importOriginal()
  return { default: {
    ...mod,
    writeFileSync: vi.fn(),
  }}
})

beforeAll(() => {
  useWindowMock()
})

test('New expert', () => {
  const expert = service.newExpert()
  expect(expert).toStrictEqual({
    id: null,
    type: 'user',
    name: 'New expert',
    prompt: '',
    state: 'enabled',
    triggerApps: [],

  })
})

test('Load default experts', () => {
  const experts = main.loadExperts(app, 'test-workspace')
  expect(experts).toHaveLength(165)
  experts.forEach((expert) => {
    expect(expert).toHaveProperty('id')
    expect(expert.type).toEqual('system')
    expect(expert.state).toEqual('enabled')
  })
})

test('Load custom experts', () => {
  const experts = main.loadExperts('./tests/fixtures/experts1.json', 'test-workspace')
  expect(experts).toHaveLength(166)
  expect(experts.filter(c => c.type === 'user')).toHaveLength(1)
  expect(experts.filter(c => c.type === 'system')).toHaveLength(165)
  expect(experts.filter(c => c.state === 'deleted')).toHaveLength(1)
  expect(experts.filter(c => c.state === 'disabled')).toHaveLength(1)
})

test('Service Install experts', () => {
  service.loadExperts()
  expect(window.api.experts.load).toHaveBeenCalled()
  expect(store.experts).toHaveLength(3)
})

test('Service Save expert', () => {
  service.saveExperts()
  expect(window.api.experts.save).toHaveBeenCalled()
})
