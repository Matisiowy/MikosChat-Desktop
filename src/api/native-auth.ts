import { invoke } from '@tauri-apps/api/core'

import type {
  AuthResponse,
  LoginData,
  RegisterData,
} from '../types/auth'

export interface NativeAuthError {
  status: number
  message: string
}

export function isNativeAuthError(
  error: unknown,
): error is NativeAuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

export const nativeAuth = {
  login(input: LoginData) {
    return invoke<AuthResponse>('auth_login', {
      identifier: input.identifier,
      password: input.password,
      remember: input.remember ?? false,
    })
  },

  register(input: RegisterData) {
    return invoke<AuthResponse>('auth_register', {
      username: input.username,
      email: input.email,
      displayName: input.displayName,
      password: input.password,
      remember: input.remember ?? false,
    })
  },

  refresh() {
    return invoke<AuthResponse>('auth_refresh')
  },

  logout() {
    return invoke<void>('auth_logout')
  },
}