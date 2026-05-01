import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react({
        jsxRuntime: 'automatic' // This is default, but ensure it's not set to 'classic'
    })],
})