import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: { exclude: ['@jsquash/jpeg', '@jsquash/oxipng', 'mupdf'] },
  worker: { format: 'es' },
  build: { target: 'esnext', chunkSizeWarningLimit: 1100 },
});
