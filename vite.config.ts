import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const devPort = Number(env.VITE_DEV_PORT) || 5173
  const proxyApiPath = env.VITE_PROXY_API_PATH
  const proxyTarget =
    env.VITE_PROXY_TARGET || (proxyApiPath ? 'http://localhost' : 'http://localhost:3001')

  const apiProxy = proxyApiPath
    ? {
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, proxyApiPath),
      }
    : {
        target: proxyTarget,
        changeOrigin: true,
      }

  return {
    plugins: [react()],
    server: {
      port: devPort,
      proxy: {
        '/api': apiProxy,
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
