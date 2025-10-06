// Custom select prompt for CLI

import terminalKit from 'terminal-kit'
import { resetDisplay } from './display'

const term = terminalKit.terminal

interface SelectChoice<T = string> {
  name: string
  value: T
}

interface SelectOptions<T> {
  title: string
  choices: SelectChoice<T>[]
  pageSize?: number
}

export async function selectOption<T = string>(options: SelectOptions<T>): Promise<T> {
  

  return new Promise((resolve, reject) => {

    // Move cursor down 3 lines (past footer) before displaying menu
    term('\n\n\n')

    // Display title
    term.cyan(`? ${options.title}\n`)

    // Prepare menu items (just the names)
    const menuItems = options.choices.map(choice => choice.name)

    // Call singleColumnMenu
    term.singleColumnMenu(
      menuItems,
      {
        style: term.styleReset.dim.white,     // Light gray for unselected
        selectedStyle: term.styleReset.white, // White for selected
        leftPadding: '    ',
        selectedLeftPadding: '  › ',
        cancelable: true,
        exitOnUnexpectedKey: true,
      },
      (error: Error | undefined, response: any) => {
        // Reset display to clean up menu
        resetDisplay()

        if (error) {
          reject(error)
          return
        }

        // Check if cancelled (escape pressed or unexpected key)
        if (!response.submitted) {
          // Just resolve empty instead of rejecting - caller can handle it
          resolve('' as T)
          return
        }

        // Resolve with the selected value
        const selectedChoice = options.choices[response.selectedIndex]
        resolve(selectedChoice.value)
      }
    )
  })
}
