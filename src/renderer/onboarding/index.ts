
export const preventTabOnLastEngineGridInput = (event: KeyboardEvent) => {
  const grid = (event.target as HTMLElement).closest('.engines-grid')
  const inputs: HTMLElement[] = Array.from(grid?.querySelectorAll('input')) || []
  const visibleInputs = inputs.filter((input) => {
    const engine = input.closest('.engine')
    const style = window.getComputedStyle(engine)
    return style.display !== 'none'
  })
  const isLast = visibleInputs.indexOf(event.target as HTMLElement) === visibleInputs.length - 1
  if (isLast && event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault()
  }
}