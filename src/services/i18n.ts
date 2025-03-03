
import { anyDict, Command } from '../types/index'
import { createI18n, hasLocalization } from '../main/i18n.base'
import { WritableComputedRef } from 'vue'
import { I18n, Locale } from 'vue-i18n'

let i18n: I18n|null = null
let i18nLlm: I18n|null = null

if (!i18n) {
  const locale = window.api?.config?.localeUI() || 'en-US'
  i18n = createI18n(locale)
}

if (!i18nLlm) {
  const locale = window.api?.config?.localeLLM() || 'en-US'
  i18nLlm = createI18n(locale)
}

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

const t: CallableFunction = i18n?.global?.t
const tllm: CallableFunction = i18nLlm?.global?.t

const commandI18n = (command: Command, attr: 'label'|'template'): string => {
  if (!command?.id) return ''
  return command ? tllm(`commands.commands.${command.id}.${attr}`) : ''
}

const expertI18n = (expert: any, attr: 'name'|'prompt'): string => {
  if (!expert?.id) return ''
  return expert ? tllm(`experts.experts.${expert.id}.${attr}`) : ''
}

export {
  i18n as default,
  i18nLlm,
  t,
  tllm,
  getLlmLocale,
  setLlmLocale,
  i18nInstructions,
  localeToLangName,
  hasLocalization,
  commandI18n,
  expertI18n,
}
