import { Router, Request, Response } from 'express'
import { createOAuth2Client, getAuthUrl, getTokensFromCode, getUserInfo } from '../services/googleAuth.js'
import { generateToken } from '../middleware/auth.js'
import type { AuthenticatedRequest } from '../types.js'

export const authRouter = Router()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

/**
 * GET /api/auth/login
 * Redirect to Google OAuth consent screen
 */
authRouter.get('/login', (req: Request, res: Response) => {
  try {
    const oauth2Client = createOAuth2Client()
    const state = req.query.redirect as string || '/'
    const authUrl = getAuthUrl(oauth2Client, state)
    res.json({ authUrl })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Failed to generate auth URL' })
  }
})

/**
 * GET /api/auth/callback
 * Handle OAuth callback from Google
 */
authRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: authError } = req.query

    if (authError) {
      console.error('OAuth error:', authError)
      return res.redirect(`${FRONTEND_URL}?error=auth_failed`)
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${FRONTEND_URL}?error=no_code`)
    }

    const oauth2Client = createOAuth2Client()
    const tokens = await getTokensFromCode(oauth2Client, code)

    if (!tokens.access_token) {
      return res.redirect(`${FRONTEND_URL}?error=no_token`)
    }

    // Get user info
    const user = await getUserInfo(tokens.access_token)

    // Generate JWT token
    const jwtToken = generateToken(user, tokens.access_token, tokens.refresh_token || '')

    // Store in session as backup
    req.session.user = user
    req.session.accessToken = tokens.access_token
    req.session.refreshToken = tokens.refresh_token || undefined

    // Redirect to frontend with token
    const redirectPath = typeof state === 'string' && state !== 'undefined' ? state : '/'
    res.redirect(`${FRONTEND_URL}${redirectPath}?token=${encodeURIComponent(jwtToken)}`)
  } catch (error) {
    console.error('Callback error:', error)
    res.redirect(`${FRONTEND_URL}?error=callback_failed`)
  }
})

/**
 * GET /api/auth/user
 * Get current user info (requires auth)
 */
authRouter.get('/user', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token && !req.session?.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // If session exists
    if (req.session?.user) {
      return res.json({ user: req.session.user })
    }

    // Verify JWT and get user
    const jwt = await import('jsonwebtoken')
    const decoded = jwt.default.verify(token!, process.env.JWT_SECRET || 'dev-jwt-secret-change-me') as any
    
    res.json({ user: decoded.user })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(401).json({ error: 'Invalid token' })
  }
})

/**
 * POST /api/auth/logout
 * Clear session and invalidate token
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err)
    }
    res.clearCookie('connect.sid')
    res.json({ success: true })
  })
})

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' })
    }

    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    
    const { credentials } = await oauth2Client.refreshAccessToken()
    
    if (!credentials.access_token) {
      return res.status(401).json({ error: 'Failed to refresh token' })
    }

    // Get user info with new token
    const user = await getUserInfo(credentials.access_token)
    
    // Generate new JWT
    const jwtToken = generateToken(user, credentials.access_token, refreshToken)

    res.json({ token: jwtToken, user })
  } catch (error) {
    console.error('Refresh error:', error)
    res.status(401).json({ error: 'Failed to refresh token' })
  }
})
