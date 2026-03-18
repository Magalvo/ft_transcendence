import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  optimizeDeps: {
    force: true,
  },
  build: {
    chunkSizeWarningLimit: 7000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("@babylonjs")) return "babylon";
          if (id.includes("@mediapipe") || id.includes("face-api.js")) return "vision";
          if (id.includes("three") || id.includes("postprocessing")) return "three";
          if (id.includes("react") || id.includes("react-dom")) return "react-vendor";
          if (id.includes("socket.io-client")) return "socket";
          if (id.includes("axios")) return "axios";

          return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      '/avatars': {
        target: 'http://gateway:3333',
        changeOrigin: true,
      },
    },
  },
});
