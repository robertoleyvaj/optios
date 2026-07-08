'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Glasses, Eye, EyeOff, AlertCircle } from 'lucide-react'

// Usuarios demo — misma tabla que Sidebar.tsx
const USUARIOS_DEMO = [
  { nombre: 'Roberto Leyva Jaramillo',       apodo: 'Roberto', iniciales: 'RL', rol: 'administrador', sucursal: 'Todas',       nombreReceta: 'Dr. Leyva',      user: 'roberto', pass: 'admin123' },
  { nombre: 'Diany Monserrath Pérez Sánchez', apodo: 'Monse',   iniciales: 'DM', rol: 'gerente',       sucursal: 'Todas',       nombreReceta: 'Monse Pérez',    user: 'monse',   pass: 'gon2025'  },
  { nombre: 'Ana Karina Govea Delgado',       apodo: 'Karina',  iniciales: 'KG', rol: 'vendedor',      sucursal: 'Baja Visión', nombreReceta: 'Karina Govea',   user: 'karina',  pass: 'gon2025'  },
  { nombre: 'Sergio Hernández',               apodo: 'Sergio',  iniciales: 'SH', rol: 'repartidor',    sucursal: 'Todas',       nombreReceta: 'Sergio Hernández', user: 'sergio', pass: 'gon2025'  },
]

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const u = USUARIOS_DEMO.find(
      d => d.user === username.toLowerCase().trim() && d.pass === password
    )

    if (!u) {
      setError('Usuario o contraseña incorrectos')
      setLoading(false)
      return
    }

    const { user: _, pass: __, ...userData } = u
    localStorage.setItem('optios_demo_user', JSON.stringify(userData))
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel — dark */}
      <div className="hidden lg:flex w-1/2 bg-[#0B0E14] flex-col justify-between p-12 relative overflow-hidden">
        {/* acento sutil de fondo */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#0D9488]/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2.5 relative">
          <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center">
            <Glasses className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">OptiOS</span>
        </div>

        <div className="relative">
          <h2 className="text-[2.6rem] font-semibold text-white leading-[1.1] tracking-tight">
            Tu óptica,<br />
            bajo control total.
          </h2>
          <p className="text-white/45 mt-4 text-[15px] leading-relaxed max-w-sm">
            Gestiona inventario, agenda, expedientes, laboratorio y finanzas de todas tus sucursales desde un solo lugar.
          </p>

          {/* Feature list */}
          <div className="mt-10 space-y-3">
            {[
              'Inventario en tiempo real',
              'Agenda y expedientes de pacientes',
              'Control financiero por sucursal',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-[#0D9488]/15 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
                </div>
                <span className="text-white/60 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs relative">© 2026 GON Óptica. Todos los derechos reservados.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#FAFAFA] px-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center">
              <Glasses className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#0B0E14] font-semibold text-lg tracking-tight">OptiOS</span>
          </div>

          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Bienvenido</h1>
          <p className="text-zinc-400 text-sm mt-1 mb-8">Ingresa tus credenciales para continuar</p>

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
