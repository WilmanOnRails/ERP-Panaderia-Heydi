'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!identifier.trim() || !password) {
      setError('Ingresa tu usuario o correo y tu contraseña.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const result = await response.json() as { error?: string }

      if (!response.ok) {
        setError(result.error ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.')
        return
      }

      router.replace('/dashboard')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-visual">
          <Image
            src="/images/reposteria-heydi-login.png"
            alt="Productos de Repostería Heydi"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 50vw"
            className="login-image"
          />
          <div className="login-visual-copy">
            <span className="eyebrow">SISTEMA ERP DE PRODUCCION</span>
            <h1>Reposteria Heydi</h1>
            <p>Controla tu producción, inventario y operaciones desde un solo lugar.</p>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-brand-mark" aria-hidden="true">RH</div>
          <p className="eyebrow login-eyebrow">Bienvenido de nuevo</p>
          <h2 id="login-title">Iniciar sesión</h2>
          <p className="login-description">Ingresa tus datos para acceder al sistema.</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="identifier">Correo electrónico o usuario</label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              maxLength={254}
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
            />
            <label htmlFor="password">Contraseña</label>
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>
          <p className="login-demo-note">Acceso al sistema de producción</p>
        </div>
      </section>
    </main>
  )
}
