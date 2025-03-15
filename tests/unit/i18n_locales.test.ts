
import { vi, test, expect } from 'vitest'
import { app } from 'electron'
import { getLocaleMessages } from '../../src/main/i18n'
import { createI18n } from '../../src/main/i18n.base'

vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn(() => '')
    }
  }
})

const messages = getLocaleMessages(app)

for (const locale of Object.keys(messages)) {
  test(`locale ${locale}`, () => {

    // check if the locale has messages
    expect(Object.keys(messages[locale]).length).toBeGreaterThan(0)
    const t = createI18n(messages, locale).global.t as CallableFunction

    // check if the locale has instructions
    expect(messages[locale].instructions.default).toBeDefined()
    expect(messages[locale].instructions.docquery).toBeDefined()
    expect(messages[locale].instructions.setDate).toBeDefined()
    expect(messages[locale].instructions.setLang).toBeDefined()
    expect(messages[locale].instructions.titling).toBeDefined()
    expect(messages[locale].instructions.titlingUser).toBeDefined()
    expect(messages[locale].instructions.scratchpad.complete).toBeDefined()
    expect(messages[locale].instructions.scratchpad.expand).toBeDefined()
    expect(messages[locale].instructions.scratchpad.improve).toBeDefined()
    expect(messages[locale].instructions.scratchpad.prompt).toBeDefined()
    expect(messages[locale].instructions.scratchpad.simplify).toBeDefined()
    expect(messages[locale].instructions.scratchpad.spellcheck).toBeDefined()
    expect(messages[locale].instructions.scratchpad.system).toBeDefined()
    expect(messages[locale].instructions.scratchpad.takeaways).toBeDefined()
    expect(messages[locale].instructions.scratchpad.title).toBeDefined()

    // check templates are properly formatted
    expect(t('instructions.docquery').includes('{context}')).toBe(true)
    expect(t('instructions.docquery').includes('{query}')).toBe(true)
    expect(t('instructions.scratchpad.prompt').includes('{document}')).toBe(true)
    expect(t('instructions.scratchpad.prompt').includes('{ask}')).toBe(true)

    // check that commands are properly formatted
    for (const id of Object.keys(messages[locale].commands.commands)) {
      expect(t(`commands.commands.${id}.template`).includes('{input}')).toBe(true)
    }

  })
}
