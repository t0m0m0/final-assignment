import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, setAuthToken } from '../api'
import type { User } from '../types'
import { AuthContext } from './AuthContext'

const TOKEN_KEY = 'auth_token'

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ストレージが使えない環境ではセッションを保持しない
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(() => readStoredToken() !== null)

  // 保存済みトークンがあれば、/me でユーザー情報を復元する
  useEffect(() => {
    const token = readStoredToken()
    if (!token) return
    setAuthToken(token)
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        storeToken(null)
        setAuthToken(null)
      })
      .finally(() => setInitializing(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password)
    storeToken(token)
    setAuthToken(token)
    setUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    storeToken(null)
    setAuthToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, initializing, login, logout }),
    [user, initializing, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
