
export const installTabs = () => {
  const tabs = document.querySelectorAll('.tabs ul li')
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tab.querySelector('input').checked = true
      showActiveTab()
    })
  })
}

export const showActiveTab = () => {
  const tabs = document.querySelectorAll<HTMLInputElement>('.tabs input[name="tabs"]')
  const contents = document.querySelectorAll<HTMLElement>('.tabs .content')
  tabs.forEach((tab, index) => {
    contents[index].style.display = tab.checked ? 'block' : 'none'
  })
}
