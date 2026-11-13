'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function logout() {
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) {
        setError('No se pudo cerrar la sesión. Inténtalo de nuevo.')
        return
      }
      router.replace('/login')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button className="logout-button" type="button" onClick={logout} disabled={busy}>
      {busy ? 'Saliendo…' : 'Cerrar sesión'}
      {error && <span className="logout-error" role="alert">{error}</span>}
    </button>
  )
}
