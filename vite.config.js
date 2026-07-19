import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// React Compiler (babel-plugin-react-compiler) runs via @rolldown/plugin-babel.
// On Vite 8 / plugin-react 6 the old `react({ babel: { plugins } })` option is a
// no-op for the compiler — it must be wired through reactCompilerPreset here.
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
})
