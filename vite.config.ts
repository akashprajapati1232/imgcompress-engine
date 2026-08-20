import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    wasm(),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ImgCompressEngine',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs',
    },

    rollupOptions: {
      // Externalize dependencies so consumers can deduplicate them in their bundler
      // and we avoid vite-plugin-top-level-await crashing on third-party worker code.
      external: [
        '@jsquash/jpeg',
        '@jsquash/png',
        '@jsquash/oxipng',
        '@jsquash/webp',
        '@jsquash/avif',
        'pica'
      ],

      output: {
        // Preserve module structure for tree-shaking
        preserveModules: false,
        exports: 'named',
      },
    },

    // Target modern browsers that support WASM + Workers + Top-Level Await natively
    target: ['es2022', 'chrome90', 'firefox89', 'safari15', 'edge90'],

    sourcemap: true,

    // Do not minify — consumers control this
    minify: false,
  },

  worker: {
    format: 'es',
    plugins: () => [wasm()],
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
    // Browser-specific globals shim
    setupFiles: ['tests/setup.ts'],
  },
});
