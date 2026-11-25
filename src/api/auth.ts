import { api, refreshSession } from './client'
import { withSessionLock } from './session-lock'
import { nativeAuth } from './native-auth'
import { useAuthStore } from '../stores/auth.store'

import type {
  LoginData,
  RegisterData,
  User,
} from '../types/auth'

export async function login(input: LoginData) {
  return withSessionLock(async () => {
    const data = await nativeAuth.login(input)

    useAuthStore.getState().setSession(data)

    return data
  })
}

export async function register(input: RegisterData) {
  return withSessionLock(async () => {
    const data = await nativeAuth.register(input)

    useAuthStore.getState().setSession(data)

    return data
  })
}

export async function restoreSession() {
  await refreshSession()
}

export async function getMe() {
  const sessionId = useAuthStore.getState().sessionId

  const { data } = await api.get<User>('/auth/me')

  if (
    useAuthStore.getState().sessionId !== sessionId
  ) {
    throw new Error('Session changed')
  }

  useAuthStore.getState().setUser(data)

  return data
}

export async function logout() {
  await withSessionLock(async () => {
    await nativeAuth.logout()

    useAuthStore.getState().clearSession()
  })
}