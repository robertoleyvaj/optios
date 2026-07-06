'use client'

import { useState } from 'react'
import RequireRol from '@/components/RequireRol'
import {
  Plus, X, Save, Shield, Eye, EyeOff,
  ChevronDown, CheckCircle2, XCircle, Edit2,
} from 'lucide-react'

type Rol = 'administrador' | 'gerente' | 'vendedor' | 'repartidor'

type Usuario = {
  id: number
  nombre: string
  username: string
  rol: Rol
  sucursal: string
  activo: boolean
  ultimoAcceso: string
}

const ROL_CONFIG: Record<Rol, { label: string; bg: string; text: string; permisos: string[] }> = {
  administrador: {
    label: 'Administrador',
    bg: 'bg-red-50', text: 'text-red-700',
    permisos: ['Dashboard', 'Ventas', 'Inventario', 'Agenda', 'Expedientes', 'Laboratorio', 'Finanzas (costos visibles)', 'Reportes', 'Usuarios', 'Ajustes'],
  },
  gerente: {
    label: 'Gerente',
    bg: 'bg-indigo-50', text: 'text-indigo-700',
    permisos: ['Dashboard', 'Ventas', 'Inventario', 'Agenda', 'Expedientes', 'Laboratorio', 'Finanzas (sin costos de lab)', 'Reportes'],
  },
  vendedor: {
    label: 'Vendedor',
    bg: 'bg-emerald-50', text: 'text-emerald-700',
    permisos: ['Dashboard', 'Ventas (nueva venta)', 'Inventario (consulta)', 'Agenda', 'Expedientes', 'Laboratorio (sin costos)'],
  },
  repartidor: {
    label: 'Repartidor',
    bg: 'bg-orange-50', text: 'text-orange-700',
    permisos: ['Laboratorio (órdenes listas para entregar)'],
  },
}

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles', 'Todas']

const USUARIOS_MOCK: Usuario[] = [
  { id: 1, nombre: 'Roberto Leyva',    username: 'roberto',  rol: 'administrador', sucursal: 'Todas',         activo: true,  ultimoAcceso: 'Hoy, 10:42' },
  { id: 2, nombre: 'Ana Castillo',     username: 'ana',      rol: 'gerente',       sucursal: 'Baja Visión',   activo: true,  ultimoAcceso: 'Hoy, 09:15' },
  { id: 3, nombre: 'Lupita Mendoza',   username: 'lupita',   rol: 'vendedor',      sucursal: 'Baja Visión',   activo: true,  ultimoAcceso: 'Hoy, 08:55' },
  { id: 4, nombre: 'Carmen Torres',    username: 'carmen',   rol: 'vendedor',      sucursal: '5 de Mayo',     activo: true,  ultimoAcceso: 'Ayer, 18:30' },
  { id: 5, nombre: 'Sergio',            username: 'sergio',   rol: 'repartidor',    sucursal: 'Todas',         activo: true,  ultimoAcceso: 'Hoy, 09:30' },
  { id: 6, nombre: 'Marta Gutiérrez',  username: 'marta',    rol: 'vendedor',      sucursal: 'Plaza Laureles',activo: false, ultimoAcceso: 'Hace 2 semanas' },
]

const formVacio = (): Omit<Usuario, 'id' | 'ultimoAcceso'> & { password: string } => ({
  nombre: '', username: '', password: '',
  rol: 'vendedor', sucursal: 'Baja Visión', activo: true,
})

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_MOCK)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState(formVacio())
  const [showPass, setShowPass] = useState(false)
  const [rolDetalle, setRolDetalle] = useState<Rol | null>(null)

  const guardar = () => {
    if (editando) {
      setUsuarios(prev => prev.map(u => u.id === editando.id ? { ...u, ...form } : u))
    } else {
      setUsuarios(prev => [...prev, { id: Date.now(), ...form, ultimoAcceso: 'Nunca' }])
    }
    setModal(false)
  }

  const toggleActivo = (id: number) =>
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: !u.activo } : u))

  const f = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Usuarios</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Gestión de accesos y permisos por rol</p>
        </div>
        <button onClick={() => { setEditando(null); setForm(formVacio()); setModal(true) }}
          className="flex items-center gap-2 bg-[#0B0E14] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-[#1A1D27] transition-all">
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {/* Roles — referencia de permisos */}
      <div className="grid grid-cols-4 gap-4">
        {(Object.entries(ROL_CONFIG) as [Rol, typeof ROL_CONFIG[Rol]][]).map(([rol, cfg]) => (
          <button key={rol} onClick={() => setRolDetalle(rolDetalle === rol ? null : rol)}
            className={`text-left bg-white rounded-lg border border-zinc-200/80 p-4 hover:border-zinc-300 transition-all ${rolDetalle === rol ? 'ring-2 ring-[#0D9488]/40' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold px-2 py-1 rounded ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
              <Shield className="w-4 h-4 text-zinc-300" />
            </div>
            <p className="text-xs text-zinc-400 mt-1">{cfg.permisos.length} módulos · {usuarios.filter(u => u.rol === rol).length} usuario{usuarios.filter(u => u.rol === rol).length !== 1 ? 's' : ''}</p>
            {rolDetalle === rol && (
              <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3">
                {cfg.permisos.map(p => (
                  <li key={p} className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            )}
          </button>
        ))}
      </div>

      {/* Tabla usuarios */}
      <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-sm font-semibold text-zinc-700">{usuarios.length} usuarios registrados · {usuarios.filter(u => u.activo).length} activos</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              {['Usuario', 'Username', 'Rol', 'Sucursal', 'Último acceso', 'Estado', ''].map(h => (
                <th key={h} className="text-left text-xs text-zinc-400 font-medium px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {usuarios.map(u => {
              const cfg = ROL_CONFIG[u.rol]
              return (
                <tr key={u.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0B0E14] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {u.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-semibold text-zinc-700">{u.nombre}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-zinc-500">{u.username}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-zinc-500">{u.sucursal}</td>
                  <td className="px-5 py-4 text-xs text-zinc-400">{u.ultimoAcceso}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleActivo(u.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded transition-all ${u.activo ? 'bg-emerald-50 text-emerald-600 hover:bg-red-50 hover:text-red-500' : 'bg-red-50 text-red-500 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                      {u.activo ? <><CheckCircle2 className="w-3 h-3" /> Activo</> : <><XCircle className="w-3 h-3" /> Inactivo</>}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => { setEditando(u); setForm({ nombre: u.nombre, username: u.username, password: '', rol: u.rol, sucursal: u.sucursal, activo: u.activo }); setModal(true) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-800">{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button onClick={() => setModal(false)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Nombre completo</label>
                <input value={form.nombre} onChange={e => f('nombre', e.target.value)}
                  className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Username</label>
                  <input value={form.username} onChange={e => f('username', e.target.value)}
                    className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 font-mono"
                    placeholder="ej. lupita" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{editando ? 'Nueva contraseña' : 'Contraseña'}</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => f('password', e.target.value)}
                      className="w-full border border-zinc-200 rounded px-3 pr-9 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                      placeholder={editando ? 'Sin cambios' : '••••••••'} />
                    <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -tranzinc-y-1/2 text-zinc-400">
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Rol</label>
                  <div className="relative">
                    <select value={form.rol} onChange={e => f('rol', e.target.value as Rol)}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {(Object.entries(ROL_CONFIG) as [Rol, typeof ROL_CONFIG[Rol]][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sucursal</label>
                  <div className="relative">
                    <select value={form.sucursal} onChange={e => f('sucursal', e.target.value)}
                      className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                      {SUCURSALES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              {form.rol && (
                <div className={`rounded-lg p-3 text-xs space-y-1 ${ROL_CONFIG[form.rol].bg}`}>
                  <p className={`font-semibold ${ROL_CONFIG[form.rol].text}`}>Permisos del rol {ROL_CONFIG[form.rol].label}:</p>
                  <p className="text-zinc-500">{ROL_CONFIG[form.rol].permisos.join(' · ')}</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-50">Cancelar</button>
              <button onClick={guardar} disabled={!form.nombre || !form.username}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40">
                <Save className="w-4 h-4" /> {editando ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UsuariosPageProtected() {
  return (
    <RequireRol roles={['administrador']}>
      <UsuariosPage />
    </RequireRol>
  )
}
