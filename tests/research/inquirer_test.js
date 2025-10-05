#!/usr/bin/env node

// Research test to understand @inquirer/prompts behavior
// Run with: node tests/research/inquirer_test.js

import { input } from '@inquirer/prompts'
import chalk from 'chalk'

async function test() {
  console.log('=== BEFORE FOOTER ===')
  console.log('Some conversation content here')
  console.log()

  // Print footer
  console.log('──────────────────────────────────────')
  console.log('──────────────────────────────────────')
  console.log('[status line here]')

  console.log('\n=== CALLING input() ===')

  // This is where the prompt appears
  const result = await input({
    message: chalk.cyan('>'),
    default: 'test input'
  })

  console.log('\n=== AFTER input() RETURNS ===')
  console.log(`You entered: ${result}`)
  console.log('Cursor is now at this line')
  console.log('Next line')

  process.exit(0)
}

test().catch(console.error)
