
export const installTabs = (dialog: HTMLElement, callback: VoidFunction) => {
  const tabs = dialog.querySelectorAll('.tabs ul li')
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tab.querySelector('input').checked = true
      showActiveTab(dialog, callback)
    })
  })
}

export const showActiveTab = (dialog: HTMLElement, callback?: VoidFunction) => {
  const tabs = dialog.querySelectorAll<HTMLInputElement>('.tabs input[name="tabs"]')
  const contents = dialog.querySelectorAll<HTMLElement>('.tabs .content')
  tabs.forEach((tab, index) => {
    contents[index].style.display = tab.checked ? 'block' : 'none'
  })
  callback?.()
}
