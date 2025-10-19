
import { VueWrapper } from "@vue/test-utils"

export const findModelSelectorPlus = (wrapper: Omit<VueWrapper<any, any>, 'exists'>, index: number = 0) => {

  const modelSelector = wrapper.findAllComponents({ name: 'ModelSelectPlus' })[index]

  return {

    exists: () => {
      return modelSelector.exists()
    },

    get value() {
      return modelSelector.vm.value
    },

    setValue: async(value: string) => {
      await modelSelector.setValue(value)
    },

    open: async () => {
      await modelSelector.find('.control').trigger('click')
      return this
    },

    getOptions: () => {
      return modelSelector.findAll('.menu .menu-option').map(option => ({
      //id: option.find('.id') ? option.find('.id').text() : null ,
      label: option.find('.label').text(),
      }))
    },

    select: async (index: number) => {
      const options = modelSelector.findAll('.menu .menu-option')
      if (index < 0 || index >= options.length) {
      throw new Error('Index out of bounds')
      }
      await options[index].trigger('click')
    }

  }

}
