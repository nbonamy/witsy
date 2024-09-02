
import { vi, beforeAll, expect, test } from 'vitest'
import { Expert } from 'types'
import { store } from '../../src/services/store'
import * as main from '../../src/main/experts'
import * as service from '../../src/services/experts'
import defaultExperts from '../../defaults/experts.json'
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

  // api
  window.api = {
    experts: {
      load: vi.fn(() => defaultExperts as Expert[]),
      save: vi.fn(),
    }
  }

})

test('New expert', () => {
  const expert = service.newExpert()
  expect(expert).toStrictEqual({
    id: null,
    type: 'user',
    name: 'New expert',
    prompt: '',
    state: 'enabled'
  })
})

test('Load default experts', () => {
  const experts = main.loadExperts(app)
  expect(experts).toHaveLength(166)
  experts.forEach((expert) => {
    expect(expert).toHaveProperty('id')
    expect(expert.type).toEqual('system')
    expect(expert.state).toEqual('enabled')
  })
})

test('Load custom experts', () => {
  const experts = main.loadExperts('./tests/fixtures/experts1.json')
  expect(experts).toHaveLength(167)
  expect(experts.filter(c => c.type === 'user')).toHaveLength(1)
  expect(experts.filter(c => c.type === 'system')).toHaveLength(166)
  expect(experts.filter(c => c.state === 'deleted')).toHaveLength(1)
  expect(experts.filter(c => c.state === 'disabled')).toHaveLength(1)
})

test('Service Install experts', () => {
  service.loadExperts()
  expect(window.api.experts.load).toHaveBeenCalled()
  expect(store.experts).toHaveLength(166)
})

test('Service Save expert', () => {
  service.saveExperts()
  expect(window.api.experts.save).toHaveBeenCalled()
})
