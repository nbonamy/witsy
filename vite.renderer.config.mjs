import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config.mjs';
import renderer from 'vite-plugin-electron-renderer';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config
export default defineConfig((env) => {
  /** @type {import('vite').ConfigEnv<'renderer'>} */
  const forgeEnv = env;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  /** @type {import('vite').UserConfig} */
  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,
    },
    plugins: [pluginExposeRenderer(name), renderer(), vue()],
    resolve: {
      preserveSymlinks: true,
    },
    clearScreen: false,
  };
});
