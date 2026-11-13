'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '')
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!token) {
      setError('El enlace de recuperación no es válido o está incompleto.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const result = await response.json() as { error?: { message?: string }; message?: string }
      if (!response.ok) {
        setError(result.error?.message ?? 'No se pudo cambiar la contraseña. Solicita un enlace nuevo.')
        return
      }
      setSuccess(result.message ?? 'Tu contraseña se actualizó correctamente.')
      setPassword('')
      setConfirmPassword('')
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card reset-password-card" aria-labelledby="reset-title">
        <div className="login-form-panel">
          <div className="login-brand-mark" aria-hidden="true">RH</div>
          <p className="eyebrow login-eyebrow">Recupera tu cuenta</p>
          <h2 id="reset-title">Crear contraseña nueva</h2>
          <p className="login-description">Elige una contraseña de al menos 12 caracteres. El enlace solo puede utilizarse una vez.</p>
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="password">Nueva contraseña</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'reset-error' : undefined} />
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'reset-error' : undefined} />
            {error && <p id="reset-error" className="login-error" role="alert">{error} <Link href="/login" referrerPolicy="no-referrer">Solicitar otro enlace</Link></p>}
            {success && <p className="login-success" role="status">{success}</p>}
            {success ? <Link className="login-submit" href="/login" referrerPolicy="no-referrer">Volver a iniciar sesión</Link> : <button className="login-submit" type="submit" disabled={submitting}>{submitting ? 'Guardando…' : 'Actualizar contraseña'}</button>}
          </form>
        </div>
      </section>
    </main>
  )
}
