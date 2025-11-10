import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.REACT_APP_BACKEND_URL': JSON.stringify(
      (process.env as NodeJS.ProcessEnv).REACT_APP_BACKEND_URL || 'http://localhost:3001'
    ),
  },
})
