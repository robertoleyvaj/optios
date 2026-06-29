'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Glasses, Eye, EyeOff, AlertCircle } from 'lucide-react'

// Usuarios demo — misma tabla que Sidebar.tsx
const USUARIOS_DEMO = [
  { nombre: 'Roberto Leyva', iniciales: 'RL', rol: 'administrador', sucursal: 'Todas',        nombreReceta: 'Dr. Leyva',     user: 'roberto',  pass: 'admin123'  },
  { nombre: 'Ana Castillo',  iniciales: 'AC', rol: 'gerente',        sucursal: 'Baja Visión',  nombreReceta: 'Dra. Castillo', user: 'ana',       pass: 'gon2025'   },
  { nombre: 'Karina López',  iniciales: 'KL', rol: 'vendedor',       sucursal: 'Baja Visión',  nombreReceta: 'Karina López',  user: 'karina',    pass: 'gon2025'   },
  { nombre: 'Sergio',        iniciales: 'SG', rol: 'repartidor',     sucursal: 'Todas',        nombreReceta: 'Sergio',        user: 'sergio',    pass: 'gon2025'   },
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
      <div className="hidden lg:flex w-1/2 bg-[#0B1A35] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#2BBFB3] to-[#1B3A6B] flex items-center justify-center">
            <Glasses className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl">OptiOS</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight">
            Tu óptica,<br />
            bajo control total.
          </h2>
          <p className="text-white/50 mt-4 text-base leading-relaxed max-w-sm">
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
                <div className="w-5 h-5 rounded-full bg-[#2BBFB3]/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-[#2BBFB3]" />
                </div>
                <span className="text-white/70 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs">© 2025 GON Óptica. Todos los derechos reservados.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] px-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#2BBFB3] to-[#1B3A6B] flex items-center justify-center">
              <Glasses className="w-5 h-5 text-white" />
            </div>
            <span className="text-[#0B1A35] font-bold text-xl">OptiOS</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-800">Bienvenido</h1>
          <p className="text-slate-400 text-sm mt-1 mb-8">Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full border border-slate-200 bg-white rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 focus:border-[#2BBFB3] transition-all placeholder:text-slate-400"
                placeholder="ej. roberto"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-slate-200 bg-white rounded-md px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 focus:border-[#2BBFB3] transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-md px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0B1A35] text-white rounded-md py-3 text-sm font-semibold hover:bg-[#0d2145] active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            ¿Olvidaste tu contraseña? Contacta al administrador.
          </p>
        </div>
      </div>
    </div>
  )
}
