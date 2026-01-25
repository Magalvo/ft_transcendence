import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'; // Import the plugin

export default defineConfig({
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 8080,
    open: true,
  },
  plugins: [
    tailwindcss(),
  ],
});