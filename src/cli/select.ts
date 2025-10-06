// Custom select prompt for CLI

import terminalKit from 'terminal-kit'
import { resetDisplay } from './display'

const term = terminalKit.terminal

interface SelectChoice<T = string> {
  name: string
  value: T
  description?: string
}

interface SelectOptions<T> {
  title: string
  choices: SelectChoice<T>[]
  onSearchChange?: (search: string) => void
  originalChoices?: SelectChoice<T>[] // Internal: preserve full list for filtering
}

export async function selectOption<T = string>(
  options: SelectOptions<T>,
  searchString = ''
): Promise<T> {

  // Preserve original choices for filtering on backspace
  const originalChoices = options.originalChoices || options.choices

  return new Promise((resolve, reject) => {

    // Move cursor down 3 lines (past footer) before displaying menu
    term('\n\n\n')

    // Display title with search string if present
    const displayTitle = searchString ? `${options.title} ${searchString}` : options.title
    term.cyan(`? ${displayTitle}\n`)

    // Prepare menu items with aligned descriptions
    const maxNameLength = Math.max(...options.choices.map(c => c.name.length))
    const columnWidth = Math.max(20, maxNameLength + 4) // At least 20, or name + 4 spaces

    const menuItems = options.choices.map(choice => {
      if (choice.description) {
        const padding = ' '.repeat(columnWidth - choice.name.length)
        return `${choice.name}${padding}${choice.description}`
      }
      return choice.name
    })

    // Calculate max items to display (leave room for title, footer, etc.)
    const maxItems = Math.max(5, term.height - 16)

    // Limit items if there are too many
    const displayItems = menuItems.slice(0, maxItems)

    // Call singleColumnMenu
    term.singleColumnMenu(
      displayItems,
      {
        style: term.styleReset.dim.white,     // Light gray for unselected
        selectedStyle: term.styleReset.white, // White for selected
        leftPadding: '    ',
        selectedLeftPadding: '  › ',
        cancelable: true,
        exitOnUnexpectedKey: true,
        itemMaxWidth: term.width - 10,
        y: undefined, // Auto position
        continueOnSubmit: false,
        selectedIndex: 0,
        keyBindings: {
          ENTER: 'submit',
          KP_ENTER: 'submit',
          UP: 'previous',
          DOWN: 'next',
          TAB: 'cycleNext',
          SHIFT_TAB: 'cyclePrevious',
          HOME: 'first',
          END: 'last',
          BACKSPACE: 'exitWithKey',  // Changed from 'cancel' to enable filtering
          DELETE: 'cancel',
          ESCAPE: 'escape'
        }
      },
      async (error: Error | undefined, response: any) => {

        // Reset display to clean up menu
        resetDisplay()

        if (error) {
          reject(error)
          return
        }

        // Check if cancelled (escape pressed or unexpected key)
        if (!response.submitted) {

          // Handle character input for filtering
          if (response.unexpectedKey && response.unexpectedKeyData?.isCharacter) {
            const char = response.unexpectedKey
            const newSearchString = searchString + char

            // Filter choices by name containing search string (case-insensitive)
            // Strip leading "/" from names for matching
            const filteredChoices = originalChoices.filter(choice => {
              const nameToMatch = choice.name.startsWith('/')
                ? choice.name.slice(1)
                : choice.name
              return nameToMatch.toLowerCase().includes(newSearchString.toLowerCase())
            })

            // If no matches, ignore the keystroke and don't recurse
            if (filteredChoices.length === 0) {
              // Recursively call with same choices and search string (no change)
              try {
                const result = await selectOption(
                  { ...options, originalChoices },
                  searchString
                )
                resolve(result)
              } catch (err) {
                reject(err)
              }
              return
            }

            // Call onSearchChange callback if provided
            if (options.onSearchChange) {
              options.onSearchChange(newSearchString)
            }

            // Recursively call selectOption with filtered choices
            try {
              const result = await selectOption(
                { ...options, choices: filteredChoices, originalChoices },
                newSearchString
              )
              resolve(result)
            } catch (err) {
              reject(err)
            }
            return
          }

          // Handle backspace to remove last character
          if (response.unexpectedKey === 'BACKSPACE') {
            if (searchString.length > 0) {
              const newSearchString = searchString.slice(0, -1)

              // Re-filter with shorter search string from original choices
              // Strip leading "/" from names for matching
              const filteredChoices = newSearchString
                ? originalChoices.filter(choice => {
                    const nameToMatch = choice.name.startsWith('/')
                      ? choice.name.slice(1)
                      : choice.name
                    return nameToMatch.toLowerCase().includes(newSearchString.toLowerCase())
                  })
                : originalChoices

              // Call onSearchChange callback if provided
              if (options.onSearchChange) {
                options.onSearchChange(newSearchString)
              }

              // Recursively call selectOption
              try {
                const result = await selectOption(
                  { ...options, choices: filteredChoices, originalChoices },
                  newSearchString
                )
                resolve(result)
              } catch (err) {
                reject(err)
              }
              return
            }
          }

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
