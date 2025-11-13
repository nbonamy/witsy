
import { anyDict, Command, Expert, ExpertCategory } from 'types/index'
import { WritableComputedRef } from 'vue'
import { I18n, Locale } from 'vue-i18n'
import { allLanguages, createI18n, hasLocalization } from '../../main/i18n.base'

let i18n: I18n|null = null
let i18nLlm: I18n|null = null

const initI18n = (): void => {

  if (!i18n && typeof window !== 'undefined') {
    const locale = window.api?.config?.localeUI() || 'en-US'
    const messages = window.api?.config?.getI18nMessages()
    i18n = createI18n(messages, locale)
  }

  if (!i18nLlm && typeof window !== 'undefined') {
    const locale = window.api?.config?.localeLLM() || 'en-US'
    const messages = window.api?.config?.getI18nMessages()
    i18nLlm = createI18n(messages, locale)
  }

}

initI18n()

const localeToLangName = (locale: string): string => {
  const t = i18nLlm.global.t as CallableFunction
  const language = t(`common.language.${locale}`)
  return language.startsWith('common.language.') ? locale : language
}

const i18nInstructions = (config: anyDict, key: string, params?: any): string => {

  // get instructions
  const instructions = key.split('.').reduce((obj, token) => obj?.[token], config)
  if (typeof instructions === 'string' && (instructions as string)?.length) {
    return instructions
  }

  // default
  // @ts-expect-error not sure why
  return i18nLlm.global.t(key, params)

}

const getLlmLocale = (): string => {
  const i18nLlmLocale = (i18nLlm.global.locale as WritableComputedRef<Locale>)
  return i18nLlmLocale.value
}

const setLlmLocale = (locale: string): void => {
  const i18nLlmLocale = (i18nLlm.global.locale as WritableComputedRef<Locale>)
  i18nLlmLocale.value = locale
}

// @ts-expect-error this is callable!
const t: CallableFunction = (...args: any[]) => i18n?.global?.t(...args)
// @ts-expect-error this is callable!
const tllm: CallableFunction = (...args: any[]) => i18nLlm?.global?.t(...args)

type i18nCommandAttr = 'label' | 'template'
type i18nExpertAttr = 'name' | 'prompt' | 'description'
type i18nCategoryAttr = 'name'

const commandI18n = (command: Command|null, attr: i18nCommandAttr): string => {
  if (!command) return ''
  if (command[attr]) return command[attr]
  return commandI18nDefault(command, attr)
}

const commandI18nDefault = (command: Command|null, attr: i18nCommandAttr): string => {
  return command ? tllm(`commands.commands.${command.id}.${attr}`) : ''
}

const expertI18n = (expert: Expert|null, attr: i18nExpertAttr): string => {
  if (!expert) return ''
  if (expert[attr]) return expert[attr]
  return expertI18nDefault(expert, attr)
}

const expertI18nDefault = (expert: Expert|null, attr: i18nExpertAttr): string => {
  return expert ? tllm(`experts.experts.${expert.id}.${attr}`) : ''
}

const categoryI18n = (category: ExpertCategory|null, attr: i18nCategoryAttr): string => {
  if (!category) return ''
  if (category && category[attr]) return category[attr]
  return categoryI18nDefault(category, attr)
}

const categoryI18nDefault = (category: ExpertCategory|null, attr: i18nCategoryAttr): string => {
  return category ? tllm(`experts.categories.${category.id}.${attr}`) : ''
}

const fullExpertI18n = (expert: Expert|null): Expert => {
  return expert ? {
    ...expert,
    name: expertI18n(expert, 'name'),
    prompt: expertI18n(expert, 'prompt'),
    description: expertI18n(expert, 'description')
  } : undefined
}

export {
  allLanguages, categoryI18n,
  categoryI18nDefault, commandI18n,
  commandI18nDefault, i18n as default, expertI18n,
  expertI18nDefault, fullExpertI18n, getLlmLocale, hasLocalization, i18nCommandAttr,
  i18nExpertAttr, i18nInstructions, i18nLlm,
  initI18n, localeToLangName, setLlmLocale, t,
  tllm
}

