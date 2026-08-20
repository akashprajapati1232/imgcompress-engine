import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [],
  base: './',
  assetsInclude: ['**/*.wasm'],

  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'compression.worker': resolve(__dirname, 'src/worker/compression.worker.ts')
      },
      formats: ['es'],
    },

    rollupOptions: {
      external: [],
      output: {
        preserveModules: false,
        exports: 'named',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name][extname]'
      },
    },

    target: ['es2022', 'chrome90', 'firefox89', 'safari15', 'edge90'],
    sourcemap: false,
    assetsInlineLimit: 4096,
    minify: false,
  },

  worker: {
    format: 'es',
  },

  optimizeDeps: {
    exclude: [
      '@jsquash/jpeg',
      '@jsquash/png',
      '@jsquash/oxipng',
      '@jsquash/webp',
      '@jsquash/avif',
    ],
  },

  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
    setupFiles: ['tests/setup.ts'],
  },
});
