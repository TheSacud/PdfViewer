import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Todas as requisições que comecem com /pdf serão redirecionadas para o backend.
      '/pdf': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: true,
      },
      '/download': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: true,
      }
      // Se preferir, você também pode definir proxies para endpoints específicos, por exemplo:
      // '/pdf/init': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      // '/pdf/insert': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      // '/pdf/reset': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
    },
  },
});
