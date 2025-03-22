import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true
  },
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
  },
  define: {
    // Instead of using path, use a global Cesium object directly
    'CESIUM_BASE_URL': JSON.stringify('')
  },
  optimizeDeps: {
    // Exclude problematic Cesium dependencies to prevent Vite optimization issues
    include: ['cesium'],
    exclude: [
      'cesium/Build/Cesium/Workers/createVerticesFromHeightmap',
      'cesium/Build/Cesium/Workers/transferTypedArrayTest',
      'cesium/Source/Workers/transferTypedArrayTest',
      'cesium/Build/Cesium/ThirdParty/Workers',
      'cesium/Build/Cesium/Widgets/InfoBox/InfoBoxDescription.css'
    ]
  },
  publicDir: 'public',
  assetsInclude: ['**/*.wasm', '**/*.glsl'],
})
