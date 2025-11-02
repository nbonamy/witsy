
//
// Vitest configuration optimized for AI/token usage
// Uses minimal output (dot reporter) and suppresses console logs
//

import { defineConfig, mergeConfig } from 'vite'
import { getBaseConfig } from './vitest.config.base.mjs'

const baseConfig = getBaseConfig()

// Override with AI-friendly settings
const aiConfig = {
  test: {
    ...baseConfig.test,
    silent: true,
    reporters: ['dot'],
  }
}

export default defineConfig(mergeConfig(baseConfig, aiConfig))
