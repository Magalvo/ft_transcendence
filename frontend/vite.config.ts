import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/avatars': {
        target: 'http://gateway:3333',
        changeOrigin: true,
      },
    },
  },
});
