import { useEffect } from 'react'
import { useUpdateStore } from '../stores/update.store'

const INITIAL_DELAY = 15_000
const CHECK_INTERVAL = 60 * 60 * 1000

export function useAutoUpdate() {
  useEffect(() => {
    if (import.meta.env.DEV) return

    function check() {
      const store = useUpdateStore.getState()

      if (store.status === 'available') return

      void store.checkForUpdates()
    }

    const initial = window.setTimeout(
      check,
      INITIAL_DELAY,
    )

    const interval = window.setInterval(
      check,
      CHECK_INTERVAL,
    )

    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [])
}