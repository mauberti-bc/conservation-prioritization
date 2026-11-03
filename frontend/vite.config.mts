import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: Number(process.env.VITE_PORT) || 5173,
    watch: {
      usePolling: true,
    },
    fs: {
      allow: ['..'],
    },
  },
  plugins: [
    tsconfigPaths(),
    react(),
    !process.env.VITEST
      ? checker({
          typescript: true,
          eslint: {
            useFlatConfig: true,
            lintCommand: 'eslint .',
          },
        })
      : undefined,
  ],
  build: {
    outDir: 'build',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      external: ['**/*.test.ts', '**/*.test.tsx'],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  logLevel: 'info',
});
