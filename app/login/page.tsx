'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    setSubmitting(true)
    try {
      if (mode === 'register') {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, username, email, phone, password }),
        })
        const result = await response.json() as { error?: { message?: string }; message?: string }
        if (!response.ok) {
          setError(result.error?.message ?? 'No se pudo enviar la solicitud.')
          return
        }
        setSuccess(result.message ?? 'Solicitud enviada. Espera la aprobación del administrador.')
        setIdentifier(username)
        setPassword('')
        setMode('login')
        return
      }

      if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Ingresa el correo asociado a tu cuenta.')
          return
        }
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const result = await response.json() as { error?: { message?: string }; message?: string }
        if (!response.ok) {
          setError(result.error?.message ?? 'No se pudo procesar la solicitud. Inténtalo de nuevo.')
          return
        }
        setSuccess(result.message ?? 'Si existe una cuenta con ese correo, recibirás instrucciones para recuperar la contraseña.')
        return
      }

      if (!identifier.trim() || !password) {
        setError('Ingresa tu usuario o correo y tu contraseña.')
        return
      }
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
          <p className="eyebrow login-eyebrow">{mode === 'login' ? 'Bienvenido de nuevo' : mode === 'register' ? 'Solicita acceso' : 'Recupera tu cuenta'}</p>
          <h2 id="login-title">{mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Olvidaste tu contraseña'}</h2>
          <p className="login-description">
            {mode === 'login'
              ? 'Ingresa tus datos para acceder al sistema.'
              : mode === 'register'
                ? 'Un administrador deberá aprobar tu cuenta antes de que puedas entrar.'
                : 'Ingresa el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.'}
          </p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {mode === 'register' ? <>
              <label htmlFor="fullName">Nombre completo</label>
              <input id="fullName" name="fullName" autoComplete="name" maxLength={100} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
              <label htmlFor="username">Nombre de usuario</label>
              <input id="username" name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]{3,32}" required value={username} onChange={(event) => setUsername(event.target.value)} />
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
              <label htmlFor="phone">Teléfono (opcional)</label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </> : mode === 'forgot' ? <>
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </> : <>
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
            </>}
            {mode !== 'forgot' && <>
              <label htmlFor="password">Contraseña {mode === 'register' ? '(mínimo 12 caracteres)' : ''}</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 12 : undefined}
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
            </>}
            {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? 'Enviando…' : mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Enviar solicitud' : 'Enviar instrucciones'}
            </button>
          </form>
          {success && <p className="login-success" role="status">{success}</p>}
          {mode === 'login' && <p className="login-demo-note">
            <button type="button" className="login-mode-toggle" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}>
              ¿Olvidaste tu contraseña?
            </button>
          </p>}
          <p className="login-demo-note">
            {mode === 'forgot' ? '¿Recordaste tu contraseña? ' : mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes una cuenta? '}
            <button type="button" className="login-mode-toggle" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess('') }}>
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}
