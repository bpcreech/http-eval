// vite.config.ts

/// <reference types="vitest" />
// Configure Vitest (https://vitest.dev/config/)

import { resolve } from 'path';
import { defineConfig } from 'vite';
import checker from "vite-plugin-checker";
import eslint from "vite-plugin-eslint";

import dts from 'vite-plugin-dts';
// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'http-eval',
      fileName: 'http-eval',
    },
  },
  plugins: [
    dts(),
    checker({
      // e.g. use TypeScript check
      typescript: true,
    }),
    eslint(),
  ],
  test: {
    // ...
  },
});
