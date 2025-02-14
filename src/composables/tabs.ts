
export const installTabs = (dialog: HTMLElement) => {
  const tabs = dialog.querySelectorAll('.tabs ul li')
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tab.querySelector('input').checked = true
      showActiveTab(dialog)
    })
  })
}

export const showActiveTab = (dialog: HTMLElement) => {
  const tabs = dialog.querySelectorAll<HTMLInputElement>('.tabs input[name="tabs"]')
  const contents = dialog.querySelectorAll<HTMLElement>('.tabs .content')
  tabs.forEach((tab, index) => {
    contents[index].style.display = tab.checked ? 'block' : 'none'
  })
}
