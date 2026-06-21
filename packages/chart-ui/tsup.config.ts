import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Disable DTS for workspace dependencies
  splitting: false,
  sourcemap: true,
  clean: true,
});
