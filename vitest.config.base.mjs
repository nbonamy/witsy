
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
  }
}
