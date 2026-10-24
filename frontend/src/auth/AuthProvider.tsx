import { confirmSignIn, signIn, signOut, type SignInOutput } from 'aws-amplify/auth'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api'
import type { User } from '../types'
import { AuthContext, type SignInResult } from './AuthContext'
import { cognitoConfigured, getIdToken, toAuthErrorMessage } from './cognito'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(cognitoConfigured)

  // Cognito のセッションが残っていれば、/me でユーザー情報 (ロールを含む) を復元する
  useEffect(() => {
    if (!cognitoConfigured) return
    getIdToken()
      .then((token) => (token ? authApi.me().then(setUser) : undefined))
      .catch(() => signOut().catch(() => {}))
      .finally(() => setInitializing(false))
  }, [])

  /** Cognito のサインイン手順を進め、完了したら API からユーザー情報を取得する */
  const handleNextStep = useCallback(async ({ nextStep }: SignInOutput): Promise<SignInResult> => {
    switch (nextStep.signInStep) {
      case 'DONE':
        try {
          const user = await authApi.me()
          setUser(user)
          return { status: 'done', user }
        } catch (err) {
          // API 側でユーザーを取得できなければ、Cognito のセッションも破棄しておく
          await signOut().catch(() => {})
          throw err
        }
      case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
        return { status: 'newPasswordRequired' }
      default:
        // MFA などはこのアプリでは未対応 (ユーザープールで有効にする場合はここに手順を追加する)
        throw new Error(`未対応のサインイン手順です (${nextStep.signInStep})`)
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      if (!cognitoConfigured) throw new Error('Cognito の設定 (.env) がないためログインできません')
      let output: SignInOutput
      try {
        output = await signIn({ username: email, password })
      } catch (err) {
        throw new Error(toAuthErrorMessage(err))
      }
      return handleNextStep(output)
    },
    [handleNextStep],
  )

  const completeNewPassword = useCallback(
    async (newPassword: string) => {
      let output: SignInOutput
      try {
        output = await confirmSignIn({ challengeResponse: newPassword })
      } catch (err) {
        throw new Error(toAuthErrorMessage(err))
      }
      return handleNextStep(output)
    },
    [handleNextStep],
  )

  const logout = useCallback(async () => {
    try {
      // 端末に保存されたトークンを削除し、リフレッシュトークンを失効させる
      await signOut()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, initializing, login, completeNewPassword, logout }),
    [user, initializing, login, completeNewPassword, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
