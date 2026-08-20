'use client'

import { useState, useEffect, useCallback } from 'react'
import RequireRol from '@/components/RequireRol'
import { Store, Package, Box, Users, Tag, BarChart3, Truck, X, Save } from 'lucide-react'

type Cliente = { nombre?: string; email?: string; telefono?: string; direccion?: string; ciudad?: string; estado?: string }
type Armazon = { nombre?: string; modelo?: string; marca?: string; color?: string }
type Pedido = {
  id: number
  created_at: string
  estado: string
  precio_venta: number | null
  tracking: string | null
  paqueteria: string | null
  notas_admin: string | null
  notas_cliente: string | null
  paciente: string | null
  cliente_email: string | null
  clientes: Cliente | null
  armazones: Armazon | null
}

type PedidoLite = { id: number; precio_venta: number | null; estado: string; plataforma: string | null; created_at: string }
type ClienteRow = { id: number; nombre?: string; email?: string; telefono?: string; ciudad?: string; estado?: string; created_at?: string; pedidos?: PedidoLite[] }

const ESTADOS = ['pendiente', 'en proceso', 'enviado', 'entregado']
const ESTADO_STYLE: Record<string, string> = {
  'pendiente': 'bg-amber-50 text-amber-700',
  'en proceso': 'bg-blue-50 text-blue-700',
  'enviado': 'bg-violet-50 text-violet-700',
  'entregado': 'bg-emerald-50 text-emerald-700',
}
const folioDe = (id: number, tienda: string) => `${tienda === 'gon' ? 'GON' : 'VRL'}-${2846 + id}`
const $$ = (n: number) => `$${(n || 0).toLocaleString('es-MX')}`
const fFecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Tijuana' })
const nombrePedido = (p: Pedido) => p.clientes?.nombre || p.paciente || '—'

function TiendaPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [sel, setSel] = useState<Pedido | null>(null)
  const [tab, setTab] = useState<'pedidos' | 'clientes'>('pedidos')
  const [tienda, setTienda] = useState<'verly' | 'gon'>('verly')
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [cargandoCli, setCargandoCli] = useState(false)

  const cargar = useCallback(async (t: 'verly' | 'gon') => {
    setCargando(true)
    try {
      const res = await fetch(`/api/ecomm/pedidos?tienda=${t}`)
      const j = await res.json()
      setPedidos((j.ok ? j.pedidos : []) as Pedido[])
    } catch { setPedidos([]) } finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar(tienda) }, [cargar, tienda])

  const cargarClientes = useCallback(async () => {
    setCargandoCli(true)
    try {
      const res = await fetch('/api/ecomm/clientes')
      const j = await res.json()
      setClientes((j.ok ? j.clientes : []) as ClienteRow[])
    } catch { setClientes([]) } finally { setCargandoCli(false) }
  }, [])
  useEffect(() => { if (tab === 'clientes' && clientes.length === 0) cargarClientes() }, [tab, clientes.length, cargarClientes])

  const esDeTienda = (plat: string | null) => tienda === 'gon' ? plat === 'gon' : plat !== 'gon'
  const clientesTienda = clientes
    .map(c => {
      const peds = (c.pedidos ?? []).filter(p => esDeTienda(p.plataforma))
      return { ...c, nPedidos: peds.length, gastado: peds.reduce((s, p) => s + Number(p.precio_venta || 0), 0) }
    })
    .filter(c => c.nPedidos > 0)

  const porAtender = pedidos.filter(p => p.estado === 'pendiente' || p.estado === 'en proceso').length
  const enviados = pedidos.filter(p => p.estado === 'enviado').length
  const ventas = pedidos.filter(p => p.estado !== 'cancelado').reduce((s, p) => s + Number(p.precio_venta || 0), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Encabezado + selector de tienda */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-[#0D9488]" />
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Tienda en línea</h1>
        </div>
        <div className="flex items-center gap-1 border border-zinc-200 rounded-lg p-1">
          <span className="text-[11px] text-zinc-400 px-2">Tienda</span>
          <button onClick={() => setTienda('verly')}
            className={`text-sm font-semibold rounded px-3 py-1 transition-colors ${tienda === 'verly' ? 'bg-teal-50 text-teal-700' : 'text-zinc-400 hover:bg-zinc-50'}`}>Verly</button>
          <button onClick={() => setTienda('gon')}
            className={`text-sm font-semibold rounded px-3 py-1 transition-colors ${tienda === 'gon' ? 'bg-teal-50 text-teal-700' : 'text-zinc-400 hover:bg-zinc-50'}`}>GON.mx</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-zinc-200 mb-5">
        {[
          { k: 'pedidos', label: 'Pedidos', icon: Package, activo: true },
          { k: 'clientes', label: 'Clientes', icon: Users, activo: true },
          { k: 'inventario', label: 'Inventario web', icon: Box, activo: false },
          { k: 'promos', label: 'Promociones', icon: Tag, activo: false },
          { k: 'finanzas', label: 'Finanzas', icon: BarChart3, activo: false },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.k} disabled={!t.activo} onClick={() => t.activo && setTab(t.k as 'pedidos' | 'clientes')}
              className={`text-xs font-semibold px-3 py-2 border-b-2 flex items-center gap-1.5 ${tab === t.k ? 'text-[#0D9488] border-[#0D9488]' : t.activo ? 'text-zinc-500 border-transparent hover:text-zinc-700' : 'text-zinc-300 border-transparent cursor-default'}`}>
              <Icon className="w-3.5 h-3.5" /> {t.label}{!t.activo && <span className="text-[9px] text-zinc-300">pronto</span>}
            </button>
          )
        })}
      </div>

      {tab === 'pedidos' && <>
      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-amber-50 rounded-xl p-4"><p className="text-[10px] text-zinc-500 uppercase font-semibold">Por atender</p><p className="text-2xl font-bold text-amber-700">{porAtender}</p></div>
        <div className="bg-zinc-50 rounded-xl p-4"><p className="text-[10px] text-zinc-500 uppercase font-semibold">Enviados</p><p className="text-2xl font-bold text-zinc-800">{enviados}</p></div>
        <div className="bg-zinc-50 rounded-xl p-4"><p className="text-[10px] text-zinc-500 uppercase font-semibold">Ventas totales</p><p className="text-2xl font-bold text-zinc-900">{$$(ventas)}</p></div>
      </div>

      {/* Lista de pedidos */}
      <div className="bg-white ring-1 ring-zinc-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1.3fr_1.6fr_1fr_0.9fr_1fr] gap-2 px-4 py-2.5 bg-zinc-50 text-[10px] uppercase font-semibold text-zinc-400">
          <span>Folio</span><span>Cliente</span><span>Estado</span><span className="text-right">Total</span><span className="text-right">Fecha</span>
        </div>
        {cargando ? (
          <p className="text-center text-sm text-zinc-400 py-10">Cargando pedidos…</p>
        ) : pedidos.length === 0 ? (
          <p className="text-center text-sm text-zinc-400 py-10">Sin pedidos todavía.</p>
        ) : pedidos.map(p => (
          <button key={p.id} onClick={() => setSel(p)}
            className="w-full text-left grid grid-cols-[1.3fr_1.6fr_1fr_0.9fr_1fr] gap-2 px-4 py-3 border-t border-zinc-50 text-sm items-center hover:bg-zinc-50 transition-colors">
            <span className="font-mono text-xs text-zinc-500">{folioDe(p.id, tienda)}</span>
            <span className="text-zinc-700 truncate">{nombrePedido(p)}</span>
            <span><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ESTADO_STYLE[p.estado] ?? 'bg-zinc-100 text-zinc-500'}`}>{p.estado}</span></span>
            <span className="text-right font-semibold text-zinc-800">{$$(Number(p.precio_venta || 0))}</span>
            <span className="text-right text-zinc-400 text-xs">{fFecha(p.created_at)}</span>
          </button>
        ))}
      </div>
      </>}

      {tab === 'clientes' && (
        <div className="bg-white ring-1 ring-zinc-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1.6fr_0.7fr_0.9fr] gap-2 px-4 py-2.5 bg-zinc-50 text-[10px] uppercase font-semibold text-zinc-400">
            <span>Cliente</span><span>Contacto</span><span className="text-center">Pedidos</span><span className="text-right">Gastado</span>
          </div>
          {cargandoCli ? (
            <p className="text-center text-sm text-zinc-400 py-10">Cargando clientes…</p>
          ) : clientesTienda.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-10">Sin clientes en esta tienda todavía.</p>
          ) : clientesTienda.map(c => (
            <div key={c.id} className="grid grid-cols-[1.6fr_1.6fr_0.7fr_0.9fr] gap-2 px-4 py-3 border-t border-zinc-50 text-sm items-center">
              <span className="text-zinc-700 truncate">{c.nombre || '—'}<span className="block text-[11px] text-zinc-400">{[c.ciudad, c.estado].filter(Boolean).join(', ')}</span></span>
              <span className="text-zinc-500 text-xs truncate">{c.email || ''}{c.telefono ? <span className="block">{c.telefono}</span> : null}</span>
              <span className="text-center text-zinc-600">{c.nPedidos}</span>
              <span className="text-right font-semibold text-zinc-800">{$$(c.gastado)}</span>
            </div>
          ))}
        </div>
      )}

      {sel && <DetallePedido pedido={sel} tienda={tienda} onClose={() => setSel(null)} onSaved={(pp) => { setPedidos(prev => prev.map(x => x.id === pp.id ? pp : x)); setSel(pp) }} />}
    </div>
  )
}

function DetallePedido({ pedido, tienda, onClose, onSaved }: { pedido: Pedido; tienda: string; onClose: () => void; onSaved: (p: Pedido) => void }) {
  const [estado, setEstado] = useState(pedido.estado)
  const [paqueteria, setPaqueteria] = useState(pedido.paqueteria ?? '')
  const [tracking, setTracking] = useState(pedido.tracking ?? '')
  const [notas, setNotas] = useState(pedido.notas_admin ?? '')
  const [guardando, setGuardando] = useState(false)
  const c = pedido.clientes
  const a = pedido.armazones

  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await fetch('/api/ecomm/pedidos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pedido.id, estado, paqueteria, tracking, notas_admin: notas }),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      onSaved(j.pedido as Pedido)
      onClose()
    } catch (e) {
      alert('No se pudo guardar: ' + (e instanceof Error ? e.message : ''))
    } finally { setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 sticky top-0 bg-white">
          <div>
            <p className="font-mono text-xs text-zinc-400">{folioDe(pedido.id, tienda)}</p>
            <p className="text-base font-bold text-zinc-800">{nombrePedido(pedido)}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Cliente / envío */}
          <div className="text-xs text-zinc-500 space-y-0.5">
            {(c?.email || pedido.cliente_email) && <p><span className="text-zinc-400">Correo:</span> {c?.email || pedido.cliente_email}</p>}
            {c?.telefono && <p><span className="text-zinc-400">Tel:</span> {c.telefono}</p>}
            {(c?.direccion || c?.ciudad) && <p><span className="text-zinc-400">Envío:</span> {[c?.direccion, c?.ciudad, c?.estado].filter(Boolean).join(', ')}</p>}
            {a && <p><span className="text-zinc-400">Armazón:</span> {[a.marca, a.modelo || a.nombre, a.color].filter(Boolean).join(' · ')}</p>}
            <p><span className="text-zinc-400">Total:</span> <span className="font-semibold text-zinc-700">{$$(Number(pedido.precio_venta || 0))}</span></p>
            {pedido.notas_cliente && <p className="bg-zinc-50 rounded p-2 mt-1"><span className="text-zinc-400">Nota del cliente:</span> {pedido.notas_cliente}</p>}
          </div>

          {/* Estado */}
          <div>
            <p className="text-[11px] font-bold text-zinc-500 uppercase mb-2">Estado del pedido</p>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map(e => (
                <button key={e} onClick={() => setEstado(e)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${estado === e ? `${ESTADO_STYLE[e]} border-transparent` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Envío */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 mb-1 flex items-center gap-1"><Truck className="w-3 h-3" /> Paquetería</label>
              <input value={paqueteria} onChange={e => setPaqueteria(e.target.value)} placeholder="Estafeta, DHL…"
                className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Número de guía</label>
              <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking"
                className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Notas internas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              className="w-full border border-zinc-200 rounded px-2.5 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 flex gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 py-2 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-600 disabled:opacity-50">
            <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TiendaPageProtected() {
  return (
    <RequireRol roles={['administrador']}>
      <TiendaPage />
    </RequireRol>
  )
}
