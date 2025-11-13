
export type ReorderTableCallback = (ids: string[]) => void

class ReorderTable {

  draggedRow: HTMLElement
  callback: ReorderTableCallback

  constructor(callback: (ids: string[]) => void) {
    this.callback = callback
  }

  onDragStart(event: MouseEvent) {
    this.draggedRow = (event.target as HTMLElement).closest('tr')
  }

  onDragOver(event: MouseEvent) {
  
    const target = (event.target as HTMLElement).closest('tr')
    const targetIndex = Array.from(target.parentNode.children).indexOf(target);
    const draggedRowIndex = Array.from(this.draggedRow.parentNode.children).indexOf(this.draggedRow);

    // Determine where to place the dragged row
    if (targetIndex > draggedRowIndex) {
      target.after(this.draggedRow);
    } else if (targetIndex < draggedRowIndex) {
      target.before(this.draggedRow);
    }
    
  }

  onDragEnd(event: MouseEvent) {

    // do not animate
    event.preventDefault()

    // reorder array
    const rows = this.draggedRow.parentNode.querySelectorAll('tr[data-id]');
    const newOrderIds = Array.from(rows).map(row => row.getAttribute('data-id'));
  
    // call callback
    this.callback(newOrderIds);

  }

  moveDown<T>(elem: T, list: T[], tableSelector: string): boolean {

    // move element in list
    const index = list.indexOf(elem)
    if (index >= list.length - 1) return false

    
    list.splice(index, 1)
    list.splice(index + 1, 0, elem)

    try {
      // scroll commands down by one line
      if (index != 0) {
        const row = document.querySelector(`${tableSelector} tbody tr:first-child`)
        document.querySelector(tableSelector).scrollBy(0, row.clientHeight)
      }
    } catch { /* empty */ }

    return true

  }

  moveUp<T>(elem: T, list: T[], tableSelector: string): boolean {

    // move element in list
    const index = list.indexOf(elem)
    if (index <= 0) return false

    list.splice(index, 1)
    list.splice(index - 1, 0, elem)

    try {
      // scroll commands up by one line
        const row = document.querySelector(`${tableSelector} tbody tr:first-child`)
      document.querySelector(tableSelector).scrollBy(0, -row.clientHeight)
    } catch { /* empty */ }

    return true

  }

}

export default function useReorderTable(callback: ReorderTableCallback) {
  return new ReorderTable(callback)
}
