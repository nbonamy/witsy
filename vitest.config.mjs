
//
// vitest does not support the `test` option in the vite config file.
// given the base/main construct (presumably) of the vite config file,
// so we need this separate file to configure vitest.
//

import { defineConfig } from 'vite'
import { coverageConfigDefaults } from 'vitest/dist/config'
import svgLoader from 'vite-svg-loader';
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('BIcon')
        }
      }
    }),
    svgLoader()
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: 'vitest.setup.ts',
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        '*.config.ts',
        'build/*',
        'src/main.ts',
        'src/preload.ts',
        'src/renderer.ts',
        'src/automations/macos*.ts',
        'src/automations/nut*.ts',
        'src/automations/robot.ts',
        'src/automations/windows.ts',
        'src/plugins/vega.ts',
        'src/services/*worker.ts',
        'src/llms/*worker.ts',
        'src/types/**/*',
        'src/vendor/**/*',
        'tools/**/*'
      ]
    },
  },
})
