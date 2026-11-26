import { create } from 'zustand'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'ready'
  | 'error'

interface UpdateState {
  status: UpdateStatus
  version: string | null
  notes: string | null
  downloaded: number
  total: number
  error: string | null
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
  restart: () => Promise<void>
}

let pendingUpdate: Update | null = null

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: 'idle',
  version: null,
  notes: null,
  downloaded: 0,
  total: 0,
  error: null,

  checkForUpdates: async () => {
    if (import.meta.env.DEV) return

    const status = get().status

    if (
      status === 'checking' ||
      status === 'downloading' ||
      status === 'installing' ||
      status === 'ready'
    ) return

    set({
      status: 'checking',
      error: null,
      version: null,
      notes: null,
    })

    try {
      if (pendingUpdate) {
        await pendingUpdate.close()
        pendingUpdate = null
      }

      pendingUpdate = await check()

      if (!pendingUpdate) {
        set({ status: 'current' })
        return
      }

      set({
        status: 'available',
        version: pendingUpdate.version,
        notes: pendingUpdate.body ?? null,
      })
    } catch (error) {
      console.error('Update check failed:', error)

      set({
        status: 'error',
        error: 'Nie uda\u0142o si\u0119 sprawdzi\u0107 aktualizacji.',
      })
    }
  },

  installUpdate: async () => {
    if (get().status !== 'available' || !pendingUpdate) return

    const update = pendingUpdate

    set({
      status: 'downloading',
      downloaded: 0,
      total: 0,
      error: null,
    })

    try {
      await update.downloadAndInstall(event => {
        switch (event.event) {
          case 'Started':
            set({
              total: event.data.contentLength ?? 0,
              downloaded: 0,
            })
            break

          case 'Progress':
            set(state => ({
              downloaded:
                state.downloaded + event.data.chunkLength,
            }))
            break

          case 'Finished':
            set({ status: 'installing' })
            break
        }
      })

      set({ status: 'ready' })
    } catch (error) {
      console.error('Update installation failed:', error)

      set({
        status: 'error',
        error: 'Nie uda\u0142o si\u0119 zainstalowa\u0107 aktualizacji.',
      })
    } finally {
      pendingUpdate = null
      await update.close().catch(() => undefined)
    }
  },

  restart: async () => {
    if (get().status !== 'ready') return

    try {
      await relaunch()
    } catch (error) {
      console.error('Restart failed:', error)

      set({
        error: 'Uruchom ponownie aplikacj\u0119 r\u0119cznie.',
      })
    }
  },
}))