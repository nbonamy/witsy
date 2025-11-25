
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'
import vuePlugin from 'eslint-plugin-vue'
import { fixupConfigRules } from '@eslint/compat'
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import globals from 'globals'
import path from 'node:path'
import js from '@eslint/js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  // TypeScript files configuration
  ...fixupConfigRules(compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/electron',
    'plugin:import/typescript',
  )).map(config => ({
    ...config,
    files: ['**/*.ts'], // Only apply to .ts files
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsParser,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json'
        }
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Vue-specific configuration
  {
    files: ['**/*.vue'],
    plugins: {
      vue: vuePlugin,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // ONLY enforce that components used in templates are defined/imported
      'vue/no-undef-components': ['error', {
        ignorePatterns: ['webview'], // Electron built-in component
      }],
    },
  },
]
