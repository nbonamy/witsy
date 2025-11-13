
export const installTabs = (tabbedEl: HTMLElement) => {
  const tabs = tabbedEl.querySelectorAll('.tabs ul li')
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tab.querySelector('input').checked = true
      showActiveTab(tabbedEl)
    })
  })
}

export const showActiveTab = (tabbedEl: HTMLElement) => {
  const tabs = tabbedEl.querySelectorAll<HTMLInputElement>('.tabs input[name="tabs"]')
  const contents = tabbedEl.querySelectorAll<HTMLElement>('.tabs .tab-content')
  tabs.forEach((tab, index) => {
    contents[index].style.display = tab.checked ? 'flex' : 'none'
  })
}
