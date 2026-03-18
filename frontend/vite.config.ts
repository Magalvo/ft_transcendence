import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  optimizeDeps: { force: true },
  server: {
    proxy: {
      '/avatars': {
        target: 'http://gateway:3333',
        changeOrigin: true,
      },
    },
    fs: {
      strict: false,
    },
  },
  build: {
    outDir: "dist",
  },
  base: "/",
});