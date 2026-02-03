import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'chat-log-terminal',
      configureServer(server) {
        server.middlewares.use('/__chat-log', (req, res, next) => {
          if (req.method !== 'POST') return next()
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              const ts = new Date().toISOString()
              if (data.type === 'user') {
                console.log(`\n[${ts}] [Chat USER] ${(data.text || '').slice(0, 200)}`)
              } else if (data.type === 'agent') {
                console.log(`[${ts}] [Chat AGENT] ${(data.text || '').slice(0, 200)}`)
                if (data.logs?.length) data.logs.forEach((l: string) => console.log(`  ${l}`))
                if (data.toolCalls?.length) data.toolCalls.forEach((t: { name: string; result?: string }) => console.log(`  [Tool] ${t.name} → ${(t.result || '').slice(0, 80)}`))
                if (data.error) console.log(`  [Error] ${data.error}`)
              }
            } catch (_) {}
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end('{}')
          })
        })
      },
    },
  ],
  build: {
    sourcemap: true,
  },
  server: {
    sourcemapIgnoreList: (sourcePath) => sourcePath.includes('node_modules'),
    proxy: {
      // Proxy PlantUML server so diagram images load same-origin (avoids referrer/CORS issues)
      '/plantuml': {
        target: 'https://www.plantuml.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
