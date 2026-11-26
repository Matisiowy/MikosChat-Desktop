import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { RefreshCw, Download, LoaderCircle } from 'lucide-react'
import { useUpdateStore } from '../../stores/update.store'

export default function UpdateSettings() {
  const [currentVersion, setCurrentVersion] = useState('-')
  const store = useUpdateStore()
  const development = import.meta.env.DEV

  useEffect(() => {
    void getVersion()
      .then(setCurrentVersion)
      .catch(console.error)
  }, [])

  const busy = [
    'checking',
    'downloading',
    'installing',
  ].includes(store.status)

  const progress = store.total > 0
    ? Math.min(100, Math.round(
        store.downloaded / store.total * 100
      ))
    : 0

  return (
    <div className="space-y-4">
      <h3 className="font-semibold pt-4">
        Aktualizacje
      </h3>

      <div className="bg-sidebar border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <RefreshCw size={23} className="text-muted shrink-0" />

          <div className="flex-1">
            <p className="text-sm font-medium">
              MikosChat {currentVersion}
            </p>

            <p className="text-xs text-muted mt-1">
              Kanał aktualizacji: Alpha
            </p>
          </div>
        </div>

        {store.status === 'current' && (
          <p className="text-sm text-muted">
            Masz najnowszą wersję aplikacji.
          </p>
        )}

        {store.status === 'available' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary">
              Dostępna wersja {store.version}
            </p>

            {store.notes && (
              <p className="text-xs text-muted whitespace-pre-wrap max-h-40 overflow-auto">
                {store.notes}
              </p>
            )}

            <button
              onClick={() => void store.installUpdate()}
              className="bg-primary text-white rounded-lg px-4 py-2 text-sm flex items-center gap-2"
            >
              <Download size={16} />
              Pobierz i zainstaluj
            </button>
          </div>
        )}

        {store.status === 'downloading' && (
          <div className="space-y-2">
            <p className="text-sm">
              Pobieranie aktualizacji...
              {store.total > 0 && ` ${progress}%`}
            </p>

            <progress
              className="w-full accent-primary"
              max={100}
              value={store.total > 0 ? progress : undefined}
            />
          </div>
        )}

        {store.status === 'installing' && (
          <p className="text-sm text-muted">
            Instalowanie aktualizacji...
          </p>
        )}

        {store.status === 'ready' && (
          <button
            onClick={() => void store.restart()}
            className="bg-primary rounded-lg px-4 py-2 text-sm"
          >
            Uruchom ponownie
          </button>
        )}

        {store.error && (
          <p role="alert" className="text-danger text-sm">
            {store.error}
          </p>
        )}

        {store.status !== 'ready' && (
          <button
            disabled={busy || development}
            onClick={() => void store.checkForUpdates()}
            className="border border-border rounded-lg px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {busy
              ? <LoaderCircle size={16} className="animate-spin" />
              : <RefreshCw size={16} />
            }

            Sprawdź aktualizacje
          </button>
        )}

        {development && (
          <p className="text-xs text-amber-400">
            Aktualizacje są wyłączone w trybie DEV.
          </p>
        )}
      </div>
    </div>
  )
}