import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts', 'src/nobreWorker.ts', 'src/nobreNotifyListener.ts', 'src/nobreExpirationWorker.ts'],
  format: ['cjs'],
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  target: 'node24',
  platform: 'node',
});
