import { useAuth } from '../contexts/AuthContext'

interface LoginButtonProps {
  className?: string
}

export function LoginButton({ className }: LoginButtonProps) {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth()

  if (isLoading) {
    return (
      <div className={`login-button-container ${className || ''}`}>
        <span className="login-status loading">載入中...</span>
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div className={`login-button-container ${className || ''}`}>
        <div className="user-info">
          {user.picture && (
            <img 
              src={user.picture} 
              alt={user.name} 
              className="user-avatar"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="user-name" title={user.email}>{user.name}</span>
        </div>
        <button 
          className="btn-logout"
          onClick={logout}
          title="登出"
        >
          登出
        </button>
      </div>
    )
  }

  return (
    <div className={`login-button-container ${className || ''}`}>
      <button 
        className="btn-login"
        onClick={login}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        以 Google 登入
      </button>
    </div>
  )
}

// Styles to be added to index.css
export const loginButtonStyles = `
.login-button-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--surface);
  border-radius: 16px;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-size: 12px;
  color: var(--text);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-status {
  font-size: 12px;
  color: var(--text-dim);
}

.login-status.loading {
  opacity: 0.7;
}

.btn-login {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.btn-login:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.btn-login svg {
  flex-shrink: 0;
}

.btn-logout {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-logout:hover {
  background: var(--danger-bg);
  color: var(--danger);
  border-color: var(--danger);
}
`
