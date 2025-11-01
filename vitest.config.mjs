
//
// vitest does not support the `test` option in the vite config file.
// given the base/main construct (presumably) of the vite config file,
// so we need this separate file to configure vitest.
//

import { defineConfig } from 'vite'
import { getBaseConfig } from './vitest.config.base.mjs'

// https://vitejs.dev/config/
export default defineConfig(getBaseConfig())
