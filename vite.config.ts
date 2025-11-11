import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Allow REACT_APP_BACKEND_URL to be optionally set at build time
    // For dev: REACT_APP_BACKEND_URL should be set in .env
    // For prod (Docker/Railway): Leave unset so api.ts uses relative URLs automatically
    'import.meta.env.REACT_APP_BACKEND_URL': JSON.stringify(process.env.REACT_APP_BACKEND_URL || ''),
  },
})
