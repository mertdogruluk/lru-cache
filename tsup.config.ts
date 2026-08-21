import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],

  // ESM only. The embedding stack this project depends on (@huggingface/transformers)
  // ships ESM-only, so a CommonJS build would be a promise we could not keep.
  format: ['esm'],

  // Emit .d.ts files, otherwise consumers get an untyped package.
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
  treeshake: true,
});
