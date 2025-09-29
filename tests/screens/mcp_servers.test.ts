
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createI18nMock } from '../mocks'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { store } from '../../src/services/store'
import McpServers from '../../src/screens/McpServers.vue'
import List from '../../src/mcp/List.vue'
import Editor from '../../src/mcp/Editor.vue'
import Dialog from '../../src/composables/dialog'
import { stubTeleport } from '../mocks/stubs'

let mcp: VueWrapper<any>

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

vi.mock('../../src/components/ContextMenuPlus.vue', () => ({
  default: {
    name: 'ContextMenuPlus',
    props: ['anchor', 'position'],
    emits: ['close'],
    template: `
      <div class="context-menu-plus-mock" data-testid="context-menu">
        <slot />
      </div>
    `
  }
}))

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
  store.loadSettings()
  store.isFeatureEnabled = () => true
  store.load = () => {}
 
  // wrapper
  mcp = mount(McpServers)
})

beforeEach(async () => {
  vi.clearAllMocks()
  mcp.vm.load()
})

test('Initialization', async () => {
  // expect(mcp.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(mcp.findComponent({ name: 'List' }).exists()).toBe(true)
  expect(window.api.mcp.getServers).toHaveBeenCalledTimes(1)
  expect(window.api.mcp.getStatus).toHaveBeenCalledTimes(1)
})

test('Actions', async () => {
  

  const list = mcp.findComponent({ name: 'List' })
  await vi.waitUntil(async () => !mcp.vm.loading, 2000)
  await list.find('button[name=reload]').trigger('click')
  expect(window.api.mcp.getServers).toHaveBeenCalledTimes(2)
  expect(window.api.mcp.getStatus).toHaveBeenCalledTimes(2)
  expect(window.api.mcp.reload).toHaveBeenCalledTimes(0)

  // restart
  await vi.waitUntil(async () => !mcp.vm.loading, 2000)
  await list.find('button[name=restart]').trigger('click')
  expect(window.api.mcp.reload).toHaveBeenCalledTimes(1)

})

test('Server enablement', async () => {
  await mcp.find<HTMLInputElement>('.mcp-server-list .server-item:nth-child(2) .stop').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith(expect.objectContaining({ uuid: '1', state: 'disabled' }))
  await mcp.find<HTMLInputElement>('.mcp-server-list .server-item:nth-child(4) .start').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith(expect.objectContaining({ uuid: 'mcp2', state: 'enabled' }))
})

test('Server delete', async () => {
  await mcp.find<HTMLTableRowElement>('.mcp-server-list .server-item:nth-child(3) .context-menu-trigger .trigger').trigger('click')
  await mcp.findComponent({ name: 'ContextMenuPlus' }).find('.delete').trigger('click')
  expect(window.api.mcp.deleteServer).toHaveBeenLastCalledWith('mcp1')
})

test('Server edit', async () => {
  await mcp.find<HTMLElement>('.servers-list .server-item:nth-child(1) .context-menu-trigger .trigger').trigger('click')
  await mcp.findComponent({ name: 'ContextMenuPlus' }).find('.edit').trigger('click')
  const editor = mcp.findComponent({ name: 'Editor' })
  expect(editor.find<HTMLSelectElement>('select[name=type]').element.value).toBe('sse')
  expect(editor.find<HTMLInputElement>('input[name=url]').element.value).toBe('http://localhost:3000')
  await editor.find<HTMLSelectElement>('select[name=type]').setValue('sse')
  await editor.find<HTMLInputElement>('input[name=url]').setValue('http://localhost:3000')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: '2',
    registryId: '2',
    state: 'enabled',
    label: '',
    type: 'sse',
    command: '',
    url: 'http://localhost:3000',
    cwd: '',
    env: {},
    headers: {},
    oauth: null,
    toolSelection: null,
  })
})

test('Normal server add - Stdio', async () => {

  const editor: VueWrapper<any> = mount(Editor, { ...stubTeleport, props: { type: 'stdio' } })
  await editor.vm.$nextTick()

  expect(editor.find<HTMLSelectElement>('select[name=type]').element.value).toBe('stdio')
  await editor.find<HTMLInputElement>('input[name=command]').setValue('npx')
  await editor.find<HTMLInputElement>('input[name=url]').setValue('script1.js')

  // save
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: undefined,
    registryId: undefined,
    state: 'enabled',
    label: '',
    type: 'stdio',
    command: 'npx',
    url: 'script1.js',
    cwd: '',
    env: {},
    headers: {},
    oauth: null,
    toolSelection: null,
  })

  // add cwd
  await editor.find<HTMLButtonElement>('button[name=pickWorkDir]').trigger('click')
  expect(window.api.file.pickDirectory).toHaveBeenCalledTimes(1)
  expect(editor.find<HTMLInputElement>('input[name=cwd]').element.value).toBe('picked_folder')
 
  // add variable
  await editor.find<HTMLButtonElement>('.button.add').trigger('click')
  const editor2 = editor.findComponent({ name: 'VariableEditor' })
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
    uuid: undefined,
    registryId: undefined,
    state: 'enabled',
    label: '',
    type: 'stdio',
    command: 'npx',
    url: 'script1.js',
    cwd: 'picked_folder',
    env: { key1: 'value1', key2: 'value2' },
    headers: {},
    oauth: null,
    toolSelection: null,
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
  await mcp.vm.$nextTick()
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: undefined,
    registryId: undefined,
    state: 'enabled',
    label: '',
    type: 'stdio',
    command: 'npx',
    url: 'script1.js',
    cwd: 'picked_folder',
    env: { key3: 'value3' },
    headers: {},
    oauth: null,
    toolSelection: null,
  })

})

test('Normal server add - HTTP', async () => {

  const editor: VueWrapper<any> = mount(Editor, { ...stubTeleport, props: { type: 'http' } })
  await editor.vm.$nextTick()

  expect(editor.find<HTMLSelectElement>('select[name=type]').element.value).toBe('http')
  await editor.find<HTMLInputElement>('input[name=url]').setValue('http://www.mcp.com')

  // save
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: undefined,
    registryId: undefined,
    state: 'enabled',
    label: '',
    type: 'http',
    command: '',
    url: 'http://www.mcp.com',
    cwd: '',
    env: {},
    headers: {},
    oauth: null,
    toolSelection: null,
  })

  // add variable
  await editor.find<HTMLButtonElement>('button.add').trigger('click')
  const editor2 = editor.findComponent({ name: 'VariableEditor' })
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
    uuid: undefined,
    registryId: undefined,
    state: 'enabled',
    label: '',
    type: 'http',
    command: '',
    url: 'http://www.mcp.com',
    cwd: '',
    env: {},
    headers: { key1: 'value1', key2: 'value2' },
    oauth: null,
    toolSelection: null,
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
    uuid: undefined,
    registryId: undefined,
    state: 'enabled',
    label: '',
    type: 'http',
    command: '',
    url: 'http://www.mcp.com',
    cwd: '',
    env: {},
    headers: { key3: 'value3' },
    oauth: null,
    toolSelection: null,
  })

})

test('Smithery server add', async () => {

  const editor: VueWrapper<any> = mount(Editor, { ...stubTeleport, props: { type: 'smithery' }})
  await editor.vm.$nextTick()

  expect(editor.find<HTMLSelectElement>('select[name=type]').element.value).toBe('smithery')
  await editor.find<HTMLInputElement>('input[name=url]').setValue('package')
  await editor.find<HTMLInputElement>('input[name=apiKey]').setValue('apiKey')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(window.api.mcp.installServer).toHaveBeenLastCalledWith('smithery', 'package', 'apiKey')

})

test('Error server add', async () => {

  const editor: VueWrapper<any> = mount(Editor, { ...stubTeleport, props: { type: 'stdio' }})

  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(Dialog.show).toHaveBeenCalledTimes(1)
  expect(Dialog.show).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'mcp.serverEditor.validation.requiredFields',
    text: 'mcp.serverEditor.validation.commandRequired'
  }))
  expect(window.api.mcp.editServer).not.toHaveBeenCalled()

  await editor.find<HTMLInputElement>('input[name=command]').setValue('npx')
  await editor.find<HTMLSelectElement>('select[name=type]').setValue('sse')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(Dialog.show).toHaveBeenCalledTimes(2)
  expect(window.api.mcp.editServer).not.toHaveBeenCalled()

  await editor.find<HTMLSelectElement>('select[name=type]').setValue('smithery')
  await editor.find<HTMLButtonElement>('button[name=save]').trigger('click')
  expect(Dialog.show).toHaveBeenCalledTimes(3)
  expect(window.api.mcp.installServer).not.toHaveBeenCalled()
})

test('JSON server parsing', async () => {

  // error cases
  const list: VueWrapper<any> = mcp.findComponent(List)
  expect(() => list.vm.validateServerJson('')).toThrowError('mcp.importJson.errorEmpty')
  expect(() => list.vm.validateServerJson('a')).toThrowError('mcp.importJson.errorFormat')
  expect(() => list.vm.validateServerJson('"hello"')).toThrowError('mcp.importJson.errorFormat')
  expect(() => list.vm.validateServerJson('[]')).toThrowError('mcp.importJson.errorFormat')
  expect(() => list.vm.validateServerJson('{ "a": 1, "b": 1 }')).toThrowError('mcp.importJson.errorMultiple')
  expect(() => list.vm.validateServerJson('"mcp": {}')).toThrowError('mcp.importJson.errorCommand')
  expect(() => list.vm.validateServerJson('"mcp": { "command": "" }')).toThrowError('mcp.importJson.errorCommand')
  expect(() => list.vm.validateServerJson('"mcp": { "command": "node" }')).toThrowError('mcp.importJson.errorArgs')
  expect(() => list.vm.validateServerJson('"mcp": { "command": "node", "args": "" }')).toThrowError('mcp.importJson.errorArgs')
  expect(() => list.vm.validateServerJson('"mcp": { "command": "node", "args": {} }')).toThrowError('mcp.importJson.errorArgs')

  // empty args
  expect(list.vm.validateServerJson('"mcp": { "command": "node", "args": [] }')).toStrictEqual({
    command: 'node',
    args: [],
  })

  // non empty args
  expect(list.vm.validateServerJson('"mcp": { "command": "node", "args": [ "-y", "pkg" ] }')).toStrictEqual({
    command: 'node',
    args: [ "-y", "pkg" ],
  })

  // trailing comma
  expect(list.vm.validateServerJson('"mcp": { "command": "node", "args": [ "-y", "pkg" ] },')).toStrictEqual({
    command: 'node',
    args: [ "-y", "pkg" ],
  })

  // env
  expect(list.vm.validateServerJson('"mcp": { "command": "node", "args": [ "-y", "pkg" ], "env": { "key": "value" } }')).toStrictEqual({
    command: 'node',
    args: [ "-y", "pkg" ],
    env: { key: 'value' },
  })

})

test('JSON server add', async () => {

  vi.mocked(Dialog.show).mockResolvedValueOnce({
    isConfirmed: true,
    value: { command: 'none', args: [ '-y', 'pkg' ], env: { key: 'value' } }
  })

  await mcp.find<HTMLElement>('button[name=addJson]').trigger('click')

  expect(window.api.mcp.editServer).toHaveBeenLastCalledWith({
    uuid: null,
    registryId: null,
    state: 'enabled',
    type: 'stdio',
    command: 'none',
    url: '-y pkg',
    env: { key: 'value' },
    toolSelection: null,
  })

})

test('Editor pickers', async () => {

  const editor: VueWrapper<any> = mount(Editor, { ...stubTeleport, props: { type: 'stdio' }})

  await editor.find<HTMLSelectElement>('select[name=source]').setValue('npx')
  expect(window.api.file.find).toHaveBeenCalledTimes(1)
  expect(window.api.file.pickFile).toHaveBeenCalledTimes(0)
  expect(editor.find<HTMLInputElement>('input[name=command]').element.value).toBe('file.ext')
 
  await editor.find<HTMLButtonElement>('button[name=pickCommand]').trigger('click')
  expect(window.api.file.find).toHaveBeenCalledTimes(1)
  expect(window.api.file.pickFile).toHaveBeenCalledTimes(1)
  expect(editor.find<HTMLInputElement>('input[name=command]').element.value).toBe('image.png')
 
  await editor.find<HTMLButtonElement>('button[name=pickScript]').trigger('click')
  expect(window.api.file.find).toHaveBeenCalledTimes(1)
  expect(window.api.file.pickFile).toHaveBeenCalledTimes(2)
  expect(editor.find<HTMLInputElement>('input[name=url]').element.value).toBe('image.png')

})
