import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authApi, setAuthToken, clearAuthToken, isAuthenticated as checkAuth } from '../api/client'

export interface User {
  id: string
  email: string
  name: string
  picture?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuthStatus = useCallback(async () => {
    try {
      // Check for token in URL (from OAuth callback)
      const params = new URLSearchParams(window.location.search)
      const tokenFromUrl = params.get('token')
      const errorFromUrl = params.get('error')
      
      if (tokenFromUrl) {
        setAuthToken(tokenFromUrl)
        // Clean URL
        const url = new URL(window.location.href)
        url.searchParams.delete('token')
        window.history.replaceState({}, '', url.toString())
      }
      
      if (errorFromUrl) {
        console.error('Auth error:', errorFromUrl)
        // Clean URL
        const url = new URL(window.location.href)
        url.searchParams.delete('error')
        window.history.replaceState({}, '', url.toString())
        setIsLoading(false)
        return
      }

      // Check if we have a token
      if (!checkAuth()) {
        setIsLoading(false)
        return
      }

      // Verify token and get user
      const result = await authApi.getUser()
      if (result?.user) {
        setUser(result.user)
      } else {
        clearAuthToken()
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      clearAuthToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  const login = useCallback(async () => {
    try {
      const authUrl = await authApi.getLoginUrl(window.location.pathname)
      window.location.href = authUrl
    } catch (error) {
      console.error('Login failed:', error)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuthToken()
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkAuth: checkAuthStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
