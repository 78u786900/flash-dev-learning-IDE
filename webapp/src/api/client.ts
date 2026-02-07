/**
 * API client for communicating with flash.dev backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('flash_dev_token', token)
  } else {
    localStorage.removeItem('flash_dev_token')
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken
  return localStorage.getItem('flash_dev_token')
}

export function clearAuthToken() {
  authToken = null
  localStorage.removeItem('flash_dev_token')
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken()
  
  const headers: HeadersInit = {
    ...options.headers,
  }
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  
  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json'
  }
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    credentials: 'include'
  })
  
  // Check for new token in response
  const newToken = response.headers.get('X-New-Token')
  if (newToken) {
    setAuthToken(newToken)
  }
  
  return response
}

// Auth API
export const authApi = {
  async getLoginUrl(redirect?: string): Promise<string> {
    const params = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
    const res = await fetch(`${API_BASE}/auth/login${params}`)
    const data = await res.json()
    return data.authUrl
  },
  
  async getUser(): Promise<{ user: { id: string; email: string; name: string; picture?: string } } | null> {
    try {
      const res = await fetchWithAuth('/auth/user')
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
  
  async logout(): Promise<void> {
    await fetchWithAuth('/auth/logout', { method: 'POST' })
    clearAuthToken()
  },
  
  async refresh(refreshToken: string): Promise<{ token: string; user: any } | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }
}

// Storage API
export const storageApi = {
  async verify(data: {
    notes: unknown[]
    timeline: unknown[]
    chatThreads: unknown[]
    canvasOverlays: Record<string, unknown[]>
    fileMetadata?: Array<{ id: string; name: string; type: string; size: number; addedAt: number; driveFileId?: string }>
  }): Promise<{
    ok: boolean
    match: boolean
    driveReachable: boolean
    details: { notesMatch: boolean; timelineMatch: boolean; chatMatch: boolean; overlaysMatch: boolean; filesMatch: boolean }
    driveCounts: { notes: number; timeline: number; chatThreads: number; totalMessages: number; overlaysKeys: number; filesCount: number }
    clientCounts: { notes: number; timeline: number; chatThreads: number; totalMessages: number; overlaysKeys: number; filesCount: number }
  } | null> {
    try {
      const res = await fetchWithAuth('/storage/verify', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },

  async getSummary(): Promise<{
    ok: boolean
    notesCount: number
    timelineCount: number
    chatThreadsCount: number
    totalMessages: number
    filesCount: number
    overlaysCount: number
    storageQuota: { limit: number; usage: number } | null
  } | null> {
    try {
      const res = await fetchWithAuth('/storage/summary')
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },

  async loadAll(): Promise<{
    notes: any[]
    timeline: any[]
    chatThreads: any[]
    canvasOverlays: Record<string, any[]>
    fileMetadata: any[]
  } | null> {
    try {
      const res = await fetchWithAuth('/storage')
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
  
  async saveAll(data: {
    notes: any[]
    timeline: any[]
    chatThreads: any[]
    canvasOverlays: Record<string, any[]>
    fileMetadata: any[]
  }): Promise<boolean> {
    try {
      const res = await fetchWithAuth('/storage', {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      return res.ok
    } catch {
      return false
    }
  },
  
  // Individual resource endpoints
  async loadNotes(): Promise<any[] | null> {
    try {
      const res = await fetchWithAuth('/storage/notes')
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
  
  async saveNotes(notes: any[]): Promise<boolean> {
    try {
      const res = await fetchWithAuth('/storage/notes', {
        method: 'PUT',
        body: JSON.stringify(notes)
      })
      return res.ok
    } catch {
      return false
    }
  },
  
  async loadTimeline(): Promise<any[] | null> {
    try {
      const res = await fetchWithAuth('/storage/timeline')
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
  
  async saveTimeline(timeline: any[]): Promise<boolean> {
    try {
      const res = await fetchWithAuth('/storage/timeline', {
        method: 'PUT',
        body: JSON.stringify(timeline)
      })
      return res.ok
    } catch {
      return false
    }
  },
  
  async loadChat(): Promise<any[] | null> {
    try {
      const res = await fetchWithAuth('/storage/chat')
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
  
  async saveChat(chatThreads: any[]): Promise<boolean> {
    try {
      const res = await fetchWithAuth('/storage/chat', {
        method: 'PUT',
        body: JSON.stringify(chatThreads)
      })
      return res.ok
    } catch {
      return false
    }
  },
  
  async loadOverlays(): Promise<Record<string, any[]> | null> {
    try {
      const res = await fetchWithAuth('/storage/overlays')
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
  
  async saveOverlays(overlays: Record<string, any[]>): Promise<boolean> {
    try {
      const res = await fetchWithAuth('/storage/overlays', {
        method: 'PUT',
        body: JSON.stringify(overlays)
      })
      return res.ok
    } catch {
      return false
    }
  }
}

// Files API
export const filesApi = {
  async list(): Promise<any[] | null> {
    try {
      const res = await fetchWithAuth('/files')
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
  
  async upload(file: File, options?: { id?: string; addedAt?: number }): Promise<{
    id: string
    name: string
    type: string
    size: number
    addedAt: number
    driveFileId: string
    url: string
  } | null> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (options?.id) formData.append('id', options.id)
      if (options?.addedAt != null) formData.append('addedAt', String(options.addedAt))
      
      const res = await fetchWithAuth('/files', {
        method: 'POST',
        body: formData
      })
      
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },

  async uploadWithProgress(
    file: File,
    onProgress: (percent: number) => void
  ): Promise<{
    id: string
    name: string
    type: string
    size: number
    addedAt: number
    driveFileId: string
    url: string
  } | null> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      onProgress(0)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        onProgress(100)
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)
            resolve(data)
          } catch {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      })

      xhr.addEventListener('error', () => resolve(null))

      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
      xhr.open('POST', `${base}/files`)
      const token = getAuthToken()
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }
      xhr.withCredentials = true
      xhr.send(formData)
    })
  },
  
  async download(id: string): Promise<Blob | null> {
    try {
      const res = await fetchWithAuth(`/files/${id}`)
      if (!res.ok) return null
      return res.blob()
    } catch {
      return null
    }
  },
  
  async getUrl(id: string): Promise<string | null> {
    try {
      const res = await fetchWithAuth(`/files/${id}/url`)
      if (!res.ok) return null
      const data = await res.json()
      return data.url
    } catch {
      return null
    }
  },
  
  async rename(id: string, name: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/files/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name })
      })
      return res.ok
    } catch {
      return false
    }
  },
  
  async delete(id: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/files/${id}`, {
        method: 'DELETE'
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export function isAuthenticated(): boolean {
  return !!getAuthToken()
}

// Drive API (for verification)
export const driveApi = {
  async verify(): Promise<{ ok: boolean; hasStorage?: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth('/drive/ensure-appdata')
      const data = await res.json()
      return data
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Failed to verify' }
    }
  }
}
