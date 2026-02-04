import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import { authRouter } from './routes/auth.js'
import { storageRouter } from './routes/storage.js'
import { filesRouter } from './routes/files.js'
import { authMiddleware } from './middleware/auth.js'

const app = express()
const PORT = process.env.PORT || 3001
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// CORS configuration
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Auth routes (public)
app.use('/api/auth', authRouter)

// Protected routes (require authentication)
app.use('/api/storage', authMiddleware, storageRouter)
app.use('/api/files', authMiddleware, filesRouter)

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

app.listen(PORT, () => {
  console.log(`🚀 flash.dev server running on http://localhost:${PORT}`)
  console.log(`📁 Frontend URL: ${FRONTEND_URL}`)
  console.log(`🔐 Google OAuth configured: ${!!process.env.GOOGLE_CLIENT_ID}`)
})

export default app
