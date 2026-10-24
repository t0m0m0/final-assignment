import { createContext, useContext } from 'react'
import type { User } from '../types'

/**
 * サインインの結果。管理者が作成したユーザーは、初回に新しいパスワードの設定を求められる
 * (その場合は completeNewPassword を呼ぶ)
 */
export type SignInResult = { status: 'done'; user: User } | { status: 'newPasswordRequired' }

export interface AuthContextValue {
  user: User | null
  /** 起動時のセッション復元中は true */
  initializing: boolean
  login: (email: string, password: string) => Promise<SignInResult>
  completeNewPassword: (newPassword: string) => Promise<SignInResult>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth は AuthProvider の内側で使用してください')
  return value
}
