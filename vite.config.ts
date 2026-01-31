import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer')) return 'vendor-codemirror';
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark') || id.includes('node_modules/rehype') || id.includes('node_modules/unified') || id.includes('node_modules/mdast') || id.includes('node_modules/hast') || id.includes('node_modules/micromark')) return 'vendor-markdown';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
