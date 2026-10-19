import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { include: ['@travel/shared'] },
  build: {
    commonjsOptions: { include: [/node_modules/, /packages\/shared\/dist/] },
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          ui: ['antd', '@ant-design/icons'],
          markdown: ['react-markdown'],
        },
      },
    },
  },
  server: { proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000' } },
});
