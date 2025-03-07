
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { switchToTab } from './settings_utils'
import Settings from '../../src/screens/Settings.vue'

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

let wrapper: VueWrapper<any>
let mcp: VueWrapper<any>

vi.mock('../../src/services/i18n', async () => {
  return {
    t: (key: string) => `${key}`,
    commandI18n: vi.fn(() => {}),
    expertI18n: vi.fn(() => {}),
  }
})

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
  store.loadSettings()
    
  // wrapper
  document.body.innerHTML = `<dialog id="settings"></dialog>`
  wrapper = mount(Settings, { attachTo: '#settings' })
})

beforeEach(async () => {
  vi.clearAllMocks()
  const tab = await switchToTab(wrapper, 6)
  await tab.find('.list-panel .list .item[data-id=mcp]').trigger('click')
  mcp = tab.findComponent({ name: 'SettingsMcp' })
})

test('init', async () => {
  expect(mcp.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(mcp.findComponent({ name: 'McpServerEditor' }).exists()).toBeTruthy()
  expect(mcp.findComponent({ name: 'McpServerEditor' }).isVisible()).toBeFalsy()
  expect(window.api.mcp.getServers).toHaveBeenCalledTimes(1)
  expect(window.api.mcp.getStatus).toHaveBeenCalledTimes(1)
})

test('plugin enablement', async () => {

  // plugin enabled
  expect(mcp.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
  await mcp.find<HTMLInputElement>('input[type=checkbox]').setValue(true)
  expect(store.config.plugins.mcp.enabled).toBe(true)

  // state should be updated
  expect(mcp.findAll<HTMLTableRowElement>('.list tbody tr')).toHaveLength(5)
  expect(mcp.findAll<HTMLTableRowElement>('.list tbody tr input[type=checkbox]:checked')).toHaveLength(3)
  expect(mcp.findAll<HTMLTableRowElement>('.list tbody tr td:nth-child(4)').map(e => e.text())).toStrictEqual([ '✅', '✅', '🔶', '❌', '🔶' ])

})

test('actions', async () => {
  
  // reload
  await mcp.find('button[name=reload]').trigger('click')
  expect(window.api.mcp.getServers).toHaveBeenCalledTimes(2)
  expect(window.api.mcp.getStatus).toHaveBeenCalledTimes(2)
  expect(window.api.mcp.reload).toHaveBeenCalledTimes(0)

  // restart
  await mcp.find('button[name=restart]').trigger('click')
  expect(window.api.mcp.reload).toHaveBeenCalledTimes(1)

})

test('server enablement', async () => {
  await mcp.find<HTMLInputElement>('.list tbody tr:nth-child(1) input[type=checkbox]').setValue(false)
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith(expect.objectContaining({ uuid: '1', state: 'disabled' }))
  await mcp.find<HTMLInputElement>('.list tbody tr:nth-child(5) input[type=checkbox]').setValue(true)
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith(expect.objectContaining({ uuid: 'mcp2', state: 'enabled' }))
})

test('server delete', async () => {
  await mcp.find<HTMLTableRowElement>('.list tbody tr:nth-child(4)').trigger('click')
  await mcp.find<HTMLButtonElement>('button.remove').trigger('click')
  await mcp.vm.$nextTick()
  expect(window.api.mcp.deleteServer).toHaveBeenLastCalledWith('@mcp1')
})

test('server edit', async () => {
  await mcp.find<HTMLTableRowElement>('.list tbody tr:nth-child(1)').trigger('click')
  await mcp.find<HTMLTableRowElement>('.list tbody tr:nth-child(1)').trigger('dblclick')
  const editor = mcp.findComponent({ name: 'McpServerEditor' })
  expect(editor.find<HTMLSelectElement>('select[name=type]').element.value).toBe('stdio')
  expect(editor.find<HTMLInputElement>('input[name=command]').element.value).toBe('node')
  expect(editor.find<HTMLInputElement>('input[name=url]').element.value).toBe('script.js')
  await editor.find<HTMLSelectElement>('select[name=type]').setValue('sse')
  await editor.find<HTMLInputElement>('input[name=url]').setValue('http://localhost:3000')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: '1',
    registryId: '1',
    state: 'enabled',
    type: 'sse',
    command: 'node',
    url: 'http://localhost:3000',
    env: {},
  })
})

test('normal server add', async () => {

  expect(mcp.find('.context-menu').exists()).toBe(false)
  await mcp.find<HTMLButtonElement>('button.add').trigger('click')
  const menu = mcp.find('.context-menu')
  expect(mcp.exists()).toBe(true)
  expect(mcp.findAll('.item').length).toBe(2)
  await menu.find('.item:nth-child(1)').trigger('click')
  expect(mcp.find('.context-menu').exists()).toBe(false)

  const editor = mcp.findComponent({ name: 'McpServerEditor' })
  expect(editor.find<HTMLSelectElement>('select[name=type]').element.value).toBe('stdio')
  await editor.find<HTMLInputElement>('input[name=command]').setValue('npx')
  await editor.find<HTMLInputElement>('input[name=url]').setValue('script1.js')
  
  // save
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: null,
    registryId: null,
    state: 'enabled',
    type: 'stdio',
    command: 'npx',
    url: 'script1.js',
    env: { },
  })

  // add variable
  await editor.find<HTMLButtonElement>('button.add').trigger('click')
  const editor2 = mcp.findComponent({ name: 'McpVariableEditor' })
  expect(editor2.find<HTMLInputElement>('input[name=key]').element.value).toBe('')
  expect(editor2.find<HTMLInputElement>('input[name=value]').element.value).toBe('')
  await editor2.find<HTMLInputElement>('input[name=key]').setValue('key1')
  await editor2.find<HTMLInputElement>('input[name=value]').setValue('value1')
  await editor2.find<HTMLButtonElement>('button[name=save]').trigger('click')

  // add variable
  await editor.find<HTMLButtonElement>('button.add').trigger('click')
  await editor2.find<HTMLInputElement>('input[name=key]').setValue('key2')
  await editor2.find<HTMLInputElement>('input[name=value]').setValue('value2')
  await editor2.find<HTMLButtonElement>('button[name=save]').trigger('click')

  // save
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: null,
    registryId: null,
    state: 'enabled',
    type: 'stdio',
    command: 'npx',
    url: 'script1.js',
    env: { key1: 'value1', key2: 'value2' },
  })

  // edit variable
  await editor.find<HTMLTableRowElement>('.sticky-table-container tbody tr:nth-child(1)').trigger('click')
  await editor.find<HTMLTableRowElement>('.sticky-table-container tbody tr:nth-child(1)').trigger('dblclick')
  expect(editor2.find<HTMLInputElement>('input[name=key]').element.value).toBe('key1')
  expect(editor2.find<HTMLInputElement>('input[name=value]').element.value).toBe('value1')
  await editor2.find<HTMLInputElement>('input[name=key]').setValue('key3')
  await editor2.find<HTMLInputElement>('input[name=value]').setValue('value3')
  await editor2.find<HTMLButtonElement>('button[name=save]').trigger('click')

  // delete
  await editor.find<HTMLTableRowElement>('.sticky-table-container tbody tr:nth-child(1)').trigger('click')
  await editor.find<HTMLButtonElement>('button.remove').trigger('click')

  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: null,
    registryId: null,
    state: 'enabled',
    type: 'stdio',
    command: 'npx',
    url: 'script1.js',
    env: { key3: 'value3' },
  })

})

test('smithery server add', async () => {

  expect(mcp.find('.context-menu').exists()).toBe(false)
  await mcp.find<HTMLButtonElement>('button.add').trigger('click')
  const menu = mcp.find('.context-menu')
  expect(mcp.exists()).toBe(true)
  expect(mcp.findAll('.item').length).toBe(2)
  await menu.find('.item:nth-child(2)').trigger('click')
  expect(mcp.find('.context-menu').exists()).toBe(false)

  const editor = mcp.findComponent({ name: 'McpServerEditor' })
  expect(editor.find<HTMLSelectElement>('select[name=type]').element.value).toBe('smithery')
  await editor.find<HTMLInputElement>('input[name=url]').setValue('package')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.installServer).toHaveBeenLastCalledWith('smithery', 'package')

})

test('error server add', async () => {

  await mcp.find<HTMLButtonElement>('button.add').trigger('click')
  const menu = mcp.find('.context-menu')
  await menu.find('.item:nth-child(1)').trigger('click')

  const editor = mcp.findComponent({ name: 'McpServerEditor' })
  expect(editor.find<HTMLSelectElement>('select[name=type]').element.value).toBe('stdio')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(1)
  expect(window.api.showDialog).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'mcp.serverEditor.validation.requiredFields' }))
  expect(window.api.mcp.editServer).not.toHaveBeenCalled()

  await editor.find<HTMLInputElement>('input[name=command]').setValue('npx')
  await editor.find<HTMLSelectElement>('select[name=type]').setValue('sse')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(2)
  expect(window.api.mcp.editServer).not.toHaveBeenCalled()

  await editor.find<HTMLSelectElement>('select[name=type]').setValue('smithery')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(3)
  expect(window.api.mcp.installServer).not.toHaveBeenCalled()
})

test('editor pickers', async () => {

  await mcp.find<HTMLButtonElement>('button.add').trigger('click')
  const menu = mcp.find('.context-menu')
  await menu.find('.item:nth-child(1)').trigger('click')
  const editor = mcp.findComponent({ name: 'McpServerEditor' })

  await editor.find<HTMLSelectElement>('select[name=source]').setValue('npx')
  expect(window.api.file.find).toHaveBeenCalledTimes(1)
  expect(window.api.file.pick).toHaveBeenCalledTimes(0)
  expect(editor.find<HTMLInputElement>('input[name=command]').element.value).toBe('file.ext')
  
  await editor.find<HTMLButtonElement>('button[name=pickCommand]').trigger('click')
  expect(window.api.file.find).toHaveBeenCalledTimes(1)
  expect(window.api.file.pick).toHaveBeenCalledTimes(1)
  expect(editor.find<HTMLInputElement>('input[name=command]').element.value).toBe('image.png')
  
  await editor.find<HTMLButtonElement>('button[name=pickScript]').trigger('click')
  expect(window.api.file.find).toHaveBeenCalledTimes(1)
  expect(window.api.file.pick).toHaveBeenCalledTimes(2)
  expect(editor.find<HTMLInputElement>('input[name=url]').element.value).toBe('image.png')

})
