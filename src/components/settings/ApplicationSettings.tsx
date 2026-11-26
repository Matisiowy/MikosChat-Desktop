import { useEffect, useState } from 'react'
import { Power, Monitor, LoaderCircle } from 'lucide-react'

import {
  enable,
  disable,
  isEnabled,
} from '@tauri-apps/plugin-autostart'

export default function ApplicationSettings() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const development = import.meta.env.DEV

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const value = await isEnabled()

        if (active) setEnabled(value)
      } catch {
        if (active) {
          setError('Nie udało się odczytać ustawień autostartu.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  async function toggle() {
    if (saving || loading || development) return

    setSaving(true)
    setError('')

    try {
      const current = await isEnabled()

      if (current) {
        await disable()
      } else {
        await enable()
      }

      setEnabled(await isEnabled())
    } catch {
      setError('Nie udało się zmienić ustawień autostartu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold">Aplikacja</h2>

      <p className="text-muted text-sm mt-2">
        Zarządzaj zachowaniem MikosChat na tym komputerze.
      </p>

      <div className="mt-8 space-y-4">
        <h3 className="font-semibold">Uruchamianie</h3>

        <div className="bg-sidebar border border-border rounded-xl p-5">
          <div className="flex items-center gap-4">
            <Power size={23} className="text-muted shrink-0" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Uruchamiaj z Windowsem
              </p>

              <p className="text-xs text-muted mt-1">
                Automatycznie uruchamiaj MikosChat w tle
                po zalogowaniu do systemu.
              </p>
            </div>

            {loading || saving ? (
              <LoaderCircle
                size={22}
                className="animate-spin text-primary"
              />
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Uruchamiaj z Windowsem"
                disabled={development}
                onClick={() => void toggle()}
                className={`relative w-11 h-6 rounded-full
                  shrink-0 transition-colors
                  disabled:opacity-50 ${
                    enabled ? 'bg-primary' : 'bg-surface'
                  }`}
              >
                <span
                  className={`absolute top-1 left-1
                    w-4 h-4 bg-white rounded-full
                    transition-transform ${
                      enabled ? 'translate-x-5' : ''
                    }`}
                />
              </button>
            )}
          </div>

          {development && (
            <p className="text-xs text-amber-400 mt-4">
              Autostart będzie dostępny po zainstalowaniu
              produkcyjnej wersji aplikacji.
            </p>
          )}
        </div>

        <h3 className="font-semibold pt-4">Działanie w tle</h3>

        <div className="bg-sidebar border border-border rounded-xl p-5 flex items-center gap-4">
          <Monitor size={23} className="text-muted shrink-0" />

          <div>
            <p className="text-sm font-medium">
              Zasobnik systemowy
            </p>

            <p className="text-xs text-muted mt-1">
              Zamknięcie okna nie kończy pracy komunikatora.
              Aby zakończyć aplikację, użyj menu obok zegara.
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </>
  )
}