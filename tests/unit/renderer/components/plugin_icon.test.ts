
import { vi, beforeAll, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { store } from '@services/store'
import PluginIcon from '@components/PluginIcon.vue'
import { ToolCall } from '@/types/index'

enableAutoUnmount(afterAll)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

test('Renders icon for knowledge plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'knowledge' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // LightbulbIcon should be rendered
  expect(wrapper.html()).toContain('lightbulb')
})

test('Renders icon for search plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'search' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // GlobeIcon should be rendered
  expect(wrapper.html()).toContain('globe')
})

test('Renders icon for browse plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'browse' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // CloudDownloadIcon should be rendered
  expect(wrapper.html()).toContain('cloud-download')
})

test('Renders icon for python plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'python' } })
  expect(wrapper.find('svg').exists()).toBe(true)
})

test('Renders icon for image plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'image' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // PaletteIcon should be rendered
  expect(wrapper.html()).toContain('palette')
})

test('Renders icon for video plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'video' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // VideoIcon should be rendered
  expect(wrapper.html()).toContain('video')
})

test('Renders icon for memory plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'memory' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // IdCardIcon should be rendered
  expect(wrapper.html()).toContain('id-card')
})

test('Renders icon for youtube plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'youtube' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // SquarePlayIcon should be rendered
  expect(wrapper.html()).toContain('square-play')
})

test('Renders icon for filesystem plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'filesystem' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // FolderIcon should be rendered
  expect(wrapper.html()).toContain('folder')
})

test('Renders icon for code execution plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'code_exec_run_program' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // WorkflowIcon should be rendered
  expect(wrapper.html()).toContain('workflow')
})

test('Renders icon for vega plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'vega' } })
  expect(wrapper.find('svg').exists()).toBe(true)
})

test('Renders icon for MCP plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'mcp' } })
  expect(wrapper.find('svg').exists()).toBe(true)
})

test('Renders default icon for unknown plugin', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'unknown_plugin' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // Plug2Icon should be rendered
  expect(wrapper.html()).toContain('plug-2')
})

test('Unwraps proxy tool call to show correct icon', async () => {
  const toolCall: ToolCall = {
    id: 'test1',
    function: 'code_exec_call_tool',
    done: true,
    args: {
      tool_name: 'search',
      parameters: { query: 'test' }
    },
    result: {}
  }

  const wrapper = mount(PluginIcon, {
    props: {
      tool: 'code_exec_call_tool',
      toolCall: toolCall
    }
  })

  expect(wrapper.find('svg').exists()).toBe(true)
  // Should render search icon (GlobeIcon) instead of workflow icon
  expect(wrapper.html()).toContain('globe')
})

test('Unwraps proxy tool call to browse plugin', async () => {
  const toolCall: ToolCall = {
    id: 'test2',
    function: 'code_exec_call_tool',
    done: true,
    args: {
      tool_name: 'browse',
      parameters: { url: 'https://example.com' }
    },
    result: {}
  }

  const wrapper = mount(PluginIcon, {
    props: {
      tool: 'code_exec_call_tool',
      toolCall: toolCall
    }
  })

  expect(wrapper.find('svg').exists()).toBe(true)
  // Should render browse icon (CloudDownloadIcon)
  expect(wrapper.html()).toContain('cloud-download')
})

test('Shows workflow icon for proxy tool without tool_name param', async () => {
  const toolCall: ToolCall = {
    id: 'test3',
    function: 'code_exec_call_tool',
    done: true,
    args: {
      // No tool_name parameter
      some_other_param: 'value'
    },
    result: {}
  }

  const wrapper = mount(PluginIcon, {
    props: {
      tool: 'code_exec_call_tool',
      toolCall: toolCall
    }
  })

  expect(wrapper.find('svg').exists()).toBe(true)
  // Should show workflow icon since it can't unwrap
  expect(wrapper.html()).toContain('workflow')
})

test('Shows correct icon for non-proxy code execution tool', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'code_exec_get_tools_info' } })
  expect(wrapper.find('svg').exists()).toBe(true)
  // WorkflowIcon should be rendered
  expect(wrapper.html()).toContain('workflow')
})

test('Works without toolCall prop for regular tools', async () => {
  const wrapper = mount(PluginIcon, { props: { tool: 'python' } })
  expect(wrapper.find('svg').exists()).toBe(true)
})
