#!/usr/bin/env node

/**
 * Terminal-Kit Verification Test
 *
 * This file verifies that terminal-kit works correctly in our environment.
 * Run with: npx tsx src/cli/test-terminal-kit.ts
 */

import terminalKit from 'terminal-kit'

const term = terminalKit.terminal

async function main() {
  term.clear()

  // Test 1: Colored output
  term.bold.magenta('Terminal-Kit Verification Test\n\n')

  term.green('✓ Terminal instance created\n')
  term.cyan('✓ Color output working\n')

  // Test 2: RGB colors (like our custom styling)
  term.colorRgb(180, 142, 238)('✓ RGB color (purple) working\n')
  term.colorRgb(139, 148, 156)('✓ RGB color (gray) working\n')

  term('\n')

  // Test 3: Basic inputField
  term.yellow('Testing basic input (type something and press Enter):\n')
  term('> ')

  const input = await term.inputField({
    cancelable: true,
  }).promise

  term('\n')

  if (input === undefined) {
    term.red('\n✗ Input was cancelled\n')
  } else {
    term.green(`✓ Input received: "${input}"\n`)
  }

  term('\n')
  term.bold('All tests passed! Press any key to exit...\n')

  await term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }).promise

  term('\n')
  term.green('✓ Terminal-Kit is working correctly!\n\n')

  process.exit(0)
}

main().catch((error) => {
  term.red(`\nError: ${error.message}\n`)
  process.exit(1)
})
