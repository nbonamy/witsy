
//
// vitest does not support the `test` option in the vite config file.
// given the base/main construct (presumably) of the vite config file,
// so we need this separate file to configure vitest.
//

import { defineConfig } from 'vite'
import { coverageConfigDefaults } from 'vitest/dist/config'
import svgLoader from 'vite-svg-loader';
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@assets': path.resolve(__dirname, 'assets'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@composables': path.resolve(__dirname, 'src/renderer/composables'),
      '@css': path.resolve(__dirname, 'css'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@models': path.resolve(__dirname, 'src/models'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@root': path.resolve(__dirname, './'),
      '@screens': path.resolve(__dirname, 'src/renderer/screens'),
      '@services': path.resolve(__dirname, 'src/renderer/services'),
      '@tests': path.resolve(__dirname, 'tests'),
      'types': path.resolve(__dirname, 'src/types'),
    }
  },
  test: {
    globals: true,
    exclude: [
      '**/node_modules/**',
      './tests/e2e/**',
    ],
    environment: 'jsdom',
    setupFiles: 'vitest.setup.ts',
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        '*.config.ts',
        'out/*',
        'build/*',
        'src/cli/input.ts',
        'src/cli/main.ts',
        'src/cli/select.ts',
        'src/cli/witsyInputField.ts',
        'src/ipc_consts.ts',
        'src/main.ts',
        'src/main/automations/macos*.ts',
        'src/main/automations/nut*.ts',
        'src/main/automations/robot.ts',
        'src/main/automations/windows.ts',
        'src/main/cli_installer.ts',
        'src/main/ipc.ts',
        'src/preload.ts',
        'src/renderer.ts',
        'src/renderer/_examples/*',
        'src/renderer/audio/pcm-processor.js',
        'src/renderer/services/plugins/vega.ts',
        'src/types/**/*',
        'src/vendor/**/*',
        'tools/**/*',
      ]
    },
  },
})
