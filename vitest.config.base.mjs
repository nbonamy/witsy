
//
// Shared base configuration for Vitest
//

import { coverageConfigDefaults } from 'vitest/dist/config'
import svgLoader from 'vite-svg-loader';
import vue from '@vitejs/plugin-vue'

export function getBaseConfig() {
  return {
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
          'src/_examples/*',
          'src/ipc_consts.ts',
          'src/main.ts',
          'src/preload.ts',
          'src/renderer.ts',
          'src/automations/macos*.ts',
          'src/automations/nut*.ts',
          'src/automations/robot.ts',
          'src/automations/windows.ts',
          'src/composables/pcm-processor.js',
          'src/main/ipc.ts',
          'src/main/cli_installer.ts',
          'src/plugins/vega.ts',
          'src/types/**/*',
          'src/cli/main.ts',
          'src/cli/input.ts',
          'src/cli/witsyInputField.ts',
          'src/cli/select.ts',
          'src/vendor/**/*',
          'tools/**/*',
        ]
      },
    },
  }
}
