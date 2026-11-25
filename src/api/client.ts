import axios from 'axios'
import { useAuthStore } from '../stores/auth.store'
import { withSessionLock } from './session-lock'
import { nativeAuth, isNativeAuthError } from './native-auth'
import { API_BASE_URL } from '../config/server'

import type {
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios'

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _sessionId?: string | null
}

export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: false,
})

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: false,
})

let refreshPromise: Promise<string> | null = null

api.interceptors.request.use(config => {
  const state = useAuthStore.getState()
  const request = config as RetryConfig

  if (
    request._sessionId !== undefined &&
    request._sessionId !== state.sessionId
  ) {
    throw new Error('Session changed')
  }

  request._sessionId = state.sessionId

  if (state.accessToken) {
    config.headers.Authorization =
      `Bearer ${state.accessToken}`
  } else {
    config.headers.delete('Authorization')
  }

  return config
})

export function refreshSession(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise
  }

  const expectedSessionId =
    useAuthStore.getState().sessionId

  refreshPromise = withSessionLock(async () => {
    const previous = useAuthStore.getState()

    if (previous.sessionId !== expectedSessionId) {
      throw new Error('Session changed')
    }

    try {
      const data = await nativeAuth.refresh()

      if (
        expectedSessionId &&
        data.sessionId !== expectedSessionId
      ) {
        await nativeAuth.logout()
        useAuthStore.getState().clearSession()
        throw new Error('Session changed')
      }

      useAuthStore.getState().setSession(data)

      return data.accessToken
    } catch (error) {
      if (
        isNativeAuthError(error) &&
        error.status === 401 &&
        useAuthStore.getState().sessionId ===
          expectedSessionId
      ) {
        useAuthStore.getState().clearSession()
      }

      throw error
    }
  }).finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

api.interceptors.response.use(
  response => {
    const config = response.config as RetryConfig

    if (
      config._sessionId !==
        useAuthStore.getState().sessionId
    ) {
      throw new Error('Session changed')
    }

    return response
  },

  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined

    if (
      error.response?.status !== 401 ||
      !config ||
      config._retry
    ) {
      return Promise.reject(error)
    }

    const current = useAuthStore.getState()

    if (
      !current.sessionId ||
      config._sessionId !== current.sessionId
    ) {
      return Promise.reject(error)
    }

    config._retry = true

    const originalSessionId = current.sessionId

    if (
      !current.accessToken ||
      config.headers.Authorization ===
        `Bearer ${current.accessToken}`
    ) {
      await refreshSession()
    }

    if (
      useAuthStore.getState().sessionId !==
        originalSessionId
    ) {
      throw new Error('Session changed')
    }

    return api(config)
  },
)

export function getApiError(error: unknown): string {
  if (isNativeAuthError(error)) {
    switch (error.status) {
      case 401:
        return 'Nieprawidowe dane logowania lub wygasa sesja.'
      case 429:
        return 'Zbyt wiele prób. Spróbuj ponownie za chwil.'
      case 409:
        return 'Konto o podanych danych ju istnieje.'
      case 400:
        return 'Sprawd poprawno wprowadzonych danych.'
      case 0:
        return `Bd aplikacji: ${error.message}`
      default:
        return 'Serwer nie móg wykona operacji.'
    }
  }

  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      return 'Zbyt wiele prób. Spróbuj ponownie za chwil.'
    }

    if (error.response?.status === 401) {
      return 'Nieprawidowe dane logowania lub wygasa sesja.'
    }

    const message = error.response?.data?.message

    if (Array.isArray(message)) {
      return message.join('. ')
    }

    if (typeof message === 'string') {
      return message
    }

    if (!error.response) {
      return 'Nie mona poczy si z serwerem.'
    }
  }

  return 'Wystpi nieoczekiwany bd.'
}