'use client'

'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.push('/dashboard')
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

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="nombre@reposteriaheydi.com" />
            <label htmlFor="password">Contraseña</label>
            <div className="password-field">
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <button className="login-submit" type="button" onClick={() => router.push('/dashboard')}>Iniciar sesión</button>
          </form>
          <p className="login-demo-note">Acceso al sistema de producción</p>
        </div>
      </section>
    </main>
  )
}
