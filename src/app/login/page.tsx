'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inactivityLogout, setInactivityLogout] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('reason') === 'inactivity') {
      setInactivityLogout(true)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
    const sb = createClient()
    const usernameLower = username.toLowerCase().trim()
    const email = `${usernameLower}@gon.optios`

    // 1. Autenticar con Supabase Auth (con timeout: si Auth se atora, no nos congelamos)
    const authPromise = sb.auth.signInWithPassword({ email, password })
    const authTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000))
    const { data: authData, error: authErr } = await Promise.race([authPromise, authTimeout]) as
      Awaited<typeof authPromise>

    if (authErr || !authData.user) {
      setError('Usuario o contraseña incorrectos')
      setLoading(false)
      return
    }

    // 2. Obtener perfil (ya autenticado, puede leer su propio row)
    const { data: usuarioData, error: errUsuario } = await sb
      .from('usuarios')
      .select('id, nombre, apodo, iniciales, rol, sucursal, nombre_receta, activo')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (errUsuario || !usuarioData) {
      await sb.auth.signOut()
      setError('Error al cargar perfil. Contacta al administrador.')
      setLoading(false)
      return
    }

    if (!usuarioData.activo) {
      await sb.auth.signOut()
      setError('Tu cuenta está desactivada. Contacta al administrador.')
      setLoading(false)
      return
    }

    // 3. Guardar en localStorage para que el dashboard sepa quién es
    const perfil = {
      id:            usuarioData.id,
      nombre:        usuarioData.nombre,
      apodo:         usuarioData.apodo || usuarioData.nombre.split(' ')[0],
      iniciales:     usuarioData.iniciales || usuarioData.nombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      rol:           usuarioData.rol,
      sucursal:      usuarioData.sucursal ?? '',
      nombre_receta: usuarioData.nombre_receta ?? '',
    }
    localStorage.setItem('optios_demo_user', JSON.stringify(perfil))

    // 3b. Sincronizar user_metadata en Supabase Auth (permite que useSession lea sucursal/rol
    //     del JWT sin depender de localStorage — útil si el usuario abre otra pestaña o dispositivo)
    sb.auth.updateUser({ data: perfil }).catch(() => { /* best-effort */ })

    // 4. Actualizar último acceso y redirigir
    sb.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', usuarioData.id).then(() => {}, () => {})
    router.push('/dashboard')
    } catch {
      setError('El servidor tardó en responder. Espera unos segundos e intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel — dark */}
      <div className="hidden lg:flex w-1/2 bg-[#0B0E14] flex-col justify-between p-12 relative overflow-hidden">
        {/* acento sutil de fondo */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#0D9488]/10 blur-3xl pointer-events-none" />

        {/* Logo — wordmark */}
        <div className="relative">
          <p className="leading-none tracking-[-0.04em]">
            <span className="text-white font-bold text-2xl">Opti</span><span className="text-[#2DD4BF] font-light text-2xl">OS</span>
          </p>
          <p className="text-[10px] font-light tracking-[0.14em] text-white/40 mt-1.5 uppercase">Sistema de Gestión</p>
        </div>

        <div className="relative">
          <h2 className="text-[2.4rem] font-semibold text-white leading-[1.1] tracking-tight">
            Grupo Óptico<br />del Noroeste
          </h2>
          <p className="text-white/40 mt-4 text-[15px] leading-relaxed max-w-sm">
            Plataforma interna de gestión. Acceso exclusivo para personal autorizado.
          </p>
        </div>

        <p className="text-white/20 text-xs relative">© 2026 Grupo Óptico del Noroeste · OptiOS</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#FAFAFA] px-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo — wordmark */}
          <div className="lg:hidden mb-8">
            <p className="leading-none tracking-[-0.04em]">
              <span className="text-[#111] font-bold text-xl">Opti</span><span className="text-[#0D9488] font-light text-xl">OS</span>
            </p>
            <p className="text-[9px] font-light tracking-[0.12em] text-[#b0b0ad] mt-1 uppercase">Sistema de Gestión</p>
          </div>

          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Bienvenido</h1>
          <p className="text-zinc-400 text-sm mt-1 mb-6">Ingresa tus credenciales para continuar</p>

          {inactivityLogout && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 text-sm rounded-lg px-4 py-3 mb-4">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Sesión cerrada por inactividad. Ingresa de nuevo.</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full border border-zinc-200 bg-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-shadow placeholder:text-zinc-400"
                placeholder="ej. roberto"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-zinc-200 bg-white rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-shadow placeholder:text-zinc-400"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-[#FEF2F2] border border-red-100 text-[#DC2626] text-sm rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0B0E14] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#1A1D27] active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-400 mt-8">
            ¿Olvidaste tu contraseña? Contacta al administrador.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
