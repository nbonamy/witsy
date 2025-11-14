
import { VueWrapper } from '@vue/test-utils'

export const tabs = [
  'settingsGeneral',
  'settingsSidebar',
  'settingsLLM',
  'settingsChat',
  'settingsDeepResearch',
  'settingsModels',
  'settingsPlugins',
  'settingsCommands',
  'settingsExperts',
  'settingsVoice',
  'settingsShortcuts',
  'settingsAdvanced',
]

export const switchToTab = async (wrapper: VueWrapper<any>, i: number): Promise<Omit<VueWrapper<any, any>, 'exists'>> => {
  await wrapper.find(`.tabs .tab:nth-child(${i+1})`).trigger('click')
  return getTab(wrapper, i)
}

export const getTab = (wrapper: VueWrapper<any>, i: number): Omit<VueWrapper<any, any>, 'exists'> => {
  return wrapper.getComponent({ ref: tabs[i] })
}
