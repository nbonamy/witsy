
import { expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import Scheduler from '../../../../src/renderer/components/Scheduler.vue'

const mnt = async (schedule: string): Promise<VueWrapper<any>> => {
  const wrapper = mount(Scheduler, { props: { modelValue: schedule } })
  await wrapper.vm.$nextTick()
  return wrapper
}

test('Init empty', async () => {
  const wrapper = await mnt('')
  expect(wrapper.find<HTMLSelectElement>('select[name=interval]').element.value).toBe('')
  expect(wrapper.findAll('input').length).toBe(0)
})

test('Init minutes', async () => {
  const wrapper = await mnt('*/5 * * * *')
  expect(wrapper.find<HTMLSelectElement>('select[name=interval]').element.value).toBe('m')
  expect(wrapper.find<HTMLInputElement>('input[name=every]').element.value).toBe('5')
  expect(wrapper.find<HTMLInputElement>('input[name=on]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('input[name=at]').exists()).toBe(false)
  expect(wrapper.findAll('input[type=checkbox]').length).toBe(0)
})

test('Init hourly', async () => {
  const wrapper = await mnt('30 */5 * * *')
  expect(wrapper.find<HTMLSelectElement>('select[name=interval]').element.value).toBe('h')
  expect(wrapper.find<HTMLInputElement>('input[name=every]').element.value).toBe('5')
  expect(wrapper.find<HTMLInputElement>('input[name=on]').element.value).toBe('30')
  expect(wrapper.find<HTMLInputElement>('input[name=at]').exists()).toBe(false)
  expect(wrapper.findAll('input[type=checkbox]').length).toBe(0)
})

test('Init daily', async () => {
  const wrapper = await mnt('30 15 */2 * *')
  expect(wrapper.find<HTMLSelectElement>('select[name=interval]').element.value).toBe('d')
  expect(wrapper.find<HTMLInputElement>('input[name=every]').element.value).toBe('2')
  expect(wrapper.find<HTMLInputElement>('input[name=on]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('input[name=at]').element.value).toBe('15:30')
  expect(wrapper.findAll('input[type=checkbox]').length).toBe(0)
})

test('Init weekly', async () => {
  const wrapper = await mnt('30 15 * * 1,3,5')
  expect(wrapper.find<HTMLSelectElement>('select[name=interval]').element.value).toBe('w')
  expect(wrapper.find<HTMLInputElement>('input[name=every]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('input[name=on]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('input[name=at]').element.value).toBe('15:30')
  expect(wrapper.findAll('input[type=checkbox]').length).toBe(7)
  expect(wrapper.find<HTMLInputElement>('input[name=mon]').element.checked).toBe(true)
  expect(wrapper.find<HTMLInputElement>('input[name=tue]').element.checked).toBe(false)
  expect(wrapper.find<HTMLInputElement>('input[name=wed]').element.checked).toBe(true)
  expect(wrapper.find<HTMLInputElement>('input[name=thu]').element.checked).toBe(false)
  expect(wrapper.find<HTMLInputElement>('input[name=fri]').element.checked).toBe(true)
  expect(wrapper.find<HTMLInputElement>('input[name=sat]').element.checked).toBe(false)
  expect(wrapper.find<HTMLInputElement>('input[name=sun]').element.checked).toBe(false)
})

test('Init monthly', async () => {
  const wrapper = await mnt('30 15 5 */2 *')
  expect(wrapper.find<HTMLSelectElement>('select[name=interval]').element.value).toBe('M')
  expect(wrapper.find<HTMLInputElement>('input[name=every]').element.value).toBe('2')
  expect(wrapper.find<HTMLInputElement>('input[name=on]').element.value).toBe('5')
  expect(wrapper.find<HTMLInputElement>('input[name=at]').element.value).toBe('15:30')
  expect(wrapper.findAll('input[type=checkbox]').length).toBe(0)
})

test('Edit minutes', async () => {
  const wrapper = await mnt('')
  await wrapper.find<HTMLSelectElement>('select[name=interval]').setValue('m')
  await wrapper.find<HTMLInputElement>('input[name=every]').setValue('5')
  expect(wrapper.emitted<any>()['change'].pop()[0]).toBe('*/5 * * * *')
})

test('Edit hourly', async () => {
  const wrapper = await mnt('')
  await wrapper.find<HTMLSelectElement>('select[name=interval]').setValue('h')
  await wrapper.find<HTMLInputElement>('input[name=every]').setValue('5')
  await wrapper.find<HTMLInputElement>('input[name=on]').setValue('30')
  expect(wrapper.emitted<any>()['change'].pop()[0]).toBe('30 */5 * * *')
})

test('Edit daily', async () => {
  const wrapper = await mnt('')
  await wrapper.find<HTMLSelectElement>('select[name=interval]').setValue('d')
  await wrapper.find<HTMLInputElement>('input[name=every]').setValue('2')
  await wrapper.find<HTMLInputElement>('input[name=at]').setValue('15:30')
  expect(wrapper.emitted<any>()['change'].pop()[0]).toBe('30 15 */2 * *')
})

test('Edit weekly', async () => {
  const wrapper = await mnt('')
  await wrapper.find<HTMLSelectElement>('select[name=interval]').setValue('w')
  await wrapper.find<HTMLInputElement>('input[name=at]').setValue('15:30')
  await wrapper.find<HTMLInputElement>('input[name=sun]').setValue(true)
  await wrapper.find<HTMLInputElement>('input[name=tue]').setValue(true)
  await wrapper.find<HTMLInputElement>('input[name=wed]').setValue(true)
  await wrapper.find<HTMLInputElement>('input[name=wed]').setValue(false)
  expect(wrapper.emitted<any>()['change'].pop()[0]).toBe('30 15 * * 0,2')
})

test('Edit monthly', async () => {
  const wrapper = await mnt('')
  await wrapper.find<HTMLSelectElement>('select[name=interval]').setValue('M')
  await wrapper.find<HTMLInputElement>('input[name=every]').setValue('2')
  await wrapper.find<HTMLInputElement>('input[name=on]').setValue('5')
  await wrapper.find<HTMLInputElement>('input[name=at]').setValue('15:30')
  expect(wrapper.emitted<any>()['change'].pop()[0]).toBe('30 15 5 */2 *')
})

test('Edit clear', async () => {
  const wrapper = await mnt('')
  await wrapper.find<HTMLSelectElement>('select[name=interval]').setValue('M')
  await wrapper.find<HTMLSelectElement>('select[name=interval]').setValue('')
  expect(wrapper.emitted<any>()['change'].pop()[0]).toBe('')
})
