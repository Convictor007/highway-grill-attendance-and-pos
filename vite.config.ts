import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost'
  const proxyApiPath = env.VITE_PROXY_API_PATH || '/HG_web/api/index.php'
  const devPort = Number(env.VITE_DEV_PORT) || 5173

  return {
    plugins: [react()],
    server: {
      port: devPort,
      proxy: {
        '^/api/uploads': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/HG_web/api'),
        },
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, proxyApiPath),
        },
      },
    },
  }
})
