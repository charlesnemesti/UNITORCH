import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [react()],
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      input: {
        main: './index.html',
        whitepaper: './whitepaper.html',
        gallery: './gallery.html',
      },
    },
  },
  server: {
    watch: {
      // Windows EBUSY when multiple Vite instances watch downloaded PNGs in public/
      ignored: ['**/public/textures/lensflare/**'],
    },
  },
});
