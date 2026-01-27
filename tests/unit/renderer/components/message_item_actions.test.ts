
import { vi, beforeAll, beforeEach, afterAll, expect, test, describe } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import MessageItemActions from '@components/MessageItemActions.vue'
import Message from '@models/message'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const createMessage = (role: 'user' | 'assistant', text: string = 'test message') => {
  const msg = new Message(role, text)
  msg.type = 'text'
  msg.transient = false
  return msg
}

const mountComponent = (message: Message, chatCallbacks: Record<string, any> = {}) => {
  return mount(MessageItemActions, {
    props: {
      message,
      audioState: { playing: false },
      readAloud: vi.fn(),
    },
    global: {
      provide: {
        'chat-callbacks': chatCallbacks,
      },
    },
  })
}

describe('MessageItemActions callback-based visibility', () => {

  describe('retry action', () => {
    test('shows retry when onRetryGeneration callback is provided', () => {
      const message = createMessage('assistant')
      const wrapper = mountComponent(message, {
        onRetryGeneration: vi.fn(),
      })
      expect(wrapper.find('.action.retry').exists()).toBe(true)
    })

    test('hides retry when onRetryGeneration callback is not provided', () => {
      const message = createMessage('assistant')
      const wrapper = mountComponent(message, {})
      expect(wrapper.find('.action.retry').exists()).toBe(false)
    })
  })

  describe('quote action', () => {
    test('shows quote when onSetPrompt callback is provided', () => {
      const message = createMessage('user')
      const wrapper = mountComponent(message, {
        onSetPrompt: vi.fn(),
      })
      expect(wrapper.find('.action.quote').exists()).toBe(true)
    })

    test('hides quote when onSetPrompt callback is not provided', () => {
      const message = createMessage('user')
      const wrapper = mountComponent(message, {})
      expect(wrapper.find('.action.quote').exists()).toBe(false)
    })
  })

  describe('delete action', () => {
    test('shows delete when onDeleteMessage callback is provided', () => {
      const message = createMessage('user')
      const wrapper = mountComponent(message, {
        onDeleteMessage: vi.fn(),
      })
      expect(wrapper.find('.action.delete').exists()).toBe(true)
    })

    test('hides delete when onDeleteMessage callback is not provided', () => {
      const message = createMessage('user')
      const wrapper = mountComponent(message, {})
      expect(wrapper.find('.action.delete').exists()).toBe(false)
    })
  })

  describe('fork action', () => {
    test('shows fork when onForkChat callback is provided', () => {
      const message = createMessage('assistant')
      const wrapper = mountComponent(message, {
        onForkChat: vi.fn(),
      })
      expect(wrapper.find('.action.fork').exists()).toBe(true)
    })

    test('hides fork when onForkChat callback is not provided', () => {
      const message = createMessage('assistant')
      const wrapper = mountComponent(message, {})
      expect(wrapper.find('.action.fork').exists()).toBe(false)
    })
  })

  describe('multiple callbacks', () => {
    test('shows only actions with provided callbacks', () => {
      const message = createMessage('assistant')
      const wrapper = mountComponent(message, {
        onRetryGeneration: vi.fn(),
        // onForkChat not provided
      })
      expect(wrapper.find('.action.retry').exists()).toBe(true)
      expect(wrapper.find('.action.fork').exists()).toBe(false)
    })

    test('shows all actions when all callbacks provided', () => {
      const message = createMessage('user')
      const wrapper = mountComponent(message, {
        onRetryGeneration: vi.fn(),
        onSetPrompt: vi.fn(),
        onDeleteMessage: vi.fn(),
        onForkChat: vi.fn(),
      })
      // user message so retry won't show (wrong role), but quote, delete, fork should
      expect(wrapper.find('.action.quote').exists()).toBe(true)
      expect(wrapper.find('.action.delete').exists()).toBe(true)
      expect(wrapper.find('.action.fork').exists()).toBe(true)
    })
  })

  describe('no chatCallbacks provided', () => {
    test('hides all callback-dependent actions when chatCallbacks is undefined', () => {
      const message = createMessage('assistant')
      const wrapper = mount(MessageItemActions, {
        props: {
          message,
          audioState: { playing: false },
          readAloud: vi.fn(),
        },
        global: {
          provide: {
            // no chat-callbacks provided
          },
        },
      })
      expect(wrapper.find('.action.retry').exists()).toBe(false)
      expect(wrapper.find('.action.fork').exists()).toBe(false)
    })
  })

})

describe('MessageItemActions hiddenMessageActions', () => {

  const mountWithHidden = (message: Message, hiddenActions: string[], chatCallbacks: Record<string, any> = {}) => {
    return mount(MessageItemActions, {
      props: {
        message,
        audioState: { playing: false },
        readAloud: vi.fn(),
      },
      global: {
        provide: {
          'chat-callbacks': chatCallbacks,
          'hidden-message-actions': hiddenActions,
        },
      },
    })
  }

  test('hides retry when in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, ['retry'], {
      onRetryGeneration: vi.fn(),
    })
    expect(wrapper.find('.action.retry').exists()).toBe(false)
  })

  test('hides fork when in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, ['fork'], {
      onForkChat: vi.fn(),
    })
    expect(wrapper.find('.action.fork').exists()).toBe(false)
  })

  test('hides quote when in hiddenMessageActions', () => {
    const message = createMessage('user')
    const wrapper = mountWithHidden(message, ['quote'], {
      onSetPrompt: vi.fn(),
    })
    expect(wrapper.find('.action.quote').exists()).toBe(false)
  })

  test('hides delete when in hiddenMessageActions', () => {
    const message = createMessage('user')
    const wrapper = mountWithHidden(message, ['delete'], {
      onDeleteMessage: vi.fn(),
    })
    expect(wrapper.find('.action.delete').exists()).toBe(false)
  })

  test('hides edit when in hiddenMessageActions', () => {
    const message = createMessage('user')
    const wrapper = mountWithHidden(message, ['edit'], {})
    expect(wrapper.find('.action.edit').exists()).toBe(false)
  })

  test('hides usage when in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    message.usage = { prompt_tokens: 10, completion_tokens: 20 }
    const wrapper = mountWithHidden(message, ['usage'], {})
    expect(wrapper.find('.action.usage').exists()).toBe(false)
  })

  test('hides copy when in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, ['copy'], {})
    expect(wrapper.findComponent({ name: 'MessageItemActionCopy' }).exists()).toBe(false)
  })

  test('hides read when in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, ['read'], {})
    expect(wrapper.findComponent({ name: 'MessageItemActionRead' }).exists()).toBe(false)
  })

  test('hides scratchpad when in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, ['scratchpad'], {})
    expect(wrapper.findComponent({ name: 'MessageItemActionScratchpad' }).exists()).toBe(false)
  })

  test('hides tools when in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    store.config.appearance.chat.showToolCalls = 'never'
    const wrapper = mountWithHidden(message, ['tools'], {})
    expect(wrapper.find('.action.tools').exists()).toBe(false)
  })

  test('hides multiple actions when multiple in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, ['retry', 'fork'], {
      onRetryGeneration: vi.fn(),
      onForkChat: vi.fn(),
    })
    expect(wrapper.find('.action.retry').exists()).toBe(false)
    expect(wrapper.find('.action.fork').exists()).toBe(false)
  })

  test('shows actions not in hiddenMessageActions', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, ['fork'], {
      onRetryGeneration: vi.fn(),
      onForkChat: vi.fn(),
    })
    expect(wrapper.find('.action.retry').exists()).toBe(true)
    expect(wrapper.find('.action.fork').exists()).toBe(false)
  })

  test('composes with callback check - hidden wins even if callback exists', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, ['retry'], {
      onRetryGeneration: vi.fn(),
    })
    expect(wrapper.find('.action.retry').exists()).toBe(false)
  })

  test('composes with callback check - no callback still hides even if not in hidden list', () => {
    const message = createMessage('assistant')
    const wrapper = mountWithHidden(message, [], {
      // no onRetryGeneration callback
    })
    expect(wrapper.find('.action.retry').exists()).toBe(false)
  })

})
