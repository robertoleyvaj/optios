'use client'

import { useState, useEffect, useCallback } from 'react'
import RequireRol from '@/components/RequireRol'
import { Store, Package, Box, Users, Tag, BarChart3, Truck, X, Save, Plus, Trash2, Mail } from 'lucide-react'

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

type Promo = { id: number; codigo: string; tipo: string; valor: number; minimo_compra: number | null; usos_maximos: number | null; usos: number | null; expires_at: string | null; descripcion: string | null; activo: boolean }
type Armz = {
  id: number; sku: string; nombre: string | null; marca: string | null; modelo: string | null
  color1: string | null; medidas: string | null; material: string | null; forma: string | null; genero: string | null
  badge: string | null
  precio: number | null; precio_gon: number | null; descuento_gon: number | null; descuento_verly: number | null
  publicar_gon: boolean | null; publicar_verly: boolean | null
  imagen_url: string | null; imagen2_url: string | null; imagen3_url: string | null; imagen4_url: string | null; imagen5_url: string | null
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
  const [tab, setTab] = useState<'pedidos' | 'clientes' | 'promos' | 'inventario'>('pedidos')
  const [tienda, setTienda] = useState<'verly' | 'gon'>('verly')
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [cargandoCli, setCargandoCli] = useState(false)
  const [promos, setPromos] = useState<Promo[]>([])
  const [cargandoPromo, setCargandoPromo] = useState(false)
  const [formPromo, setFormPromo] = useState({ codigo: '', tipo: 'porcentaje', valor: '', minimo_compra: '', usos_maximos: '', expires_at: '', descripcion: '' })
  const [guardandoPromo, setGuardandoPromo] = useState(false)
  const [mostrarFormPromo, setMostrarFormPromo] = useState(false)
  const [armazones, setArmazones] = useState<Armz[]>([])
  const [cargandoArm, setCargandoArm] = useState(false)
  const [buscarArm, setBuscarArm] = useState('')
  const [selArm, setSelArm] = useState<Armz | null>(null)
  const [soloPublicados, setSoloPublicados] = useState(true)

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

  const cargarPromos = useCallback(async () => {
    setCargandoPromo(true)
    try {
      const res = await fetch('/api/ecomm/promociones')
      const j = await res.json()
      setPromos((j.ok ? j.promos : []) as Promo[])
    } catch { setPromos([]) } finally { setCargandoPromo(false) }
  }, [])
  useEffect(() => { if (tab === 'promos' && promos.length === 0) cargarPromos() }, [tab, promos.length, cargarPromos])

  const crearPromo = async () => {
    if (!formPromo.codigo.trim() || !formPromo.valor) { alert('Falta código o valor.'); return }
    setGuardandoPromo(true)
    try {
      const res = await fetch('/api/ecomm/promociones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formPromo, activo: true }),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setPromos(prev => [j.promo as Promo, ...prev])
      setFormPromo({ codigo: '', tipo: 'porcentaje', valor: '', minimo_compra: '', usos_maximos: '', expires_at: '', descripcion: '' })
      setMostrarFormPromo(false)
    } catch (e) { alert('No se pudo crear: ' + (e instanceof Error ? e.message : '')) } finally { setGuardandoPromo(false) }
  }

  const togglePromo = async (p: Promo) => {
    const res = await fetch('/api/ecomm/promociones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, activo: !p.activo }),
    })
    const j = await res.json()
    if (j.ok) setPromos(prev => prev.map(x => x.id === p.id ? { ...x, activo: !p.activo } : x))
  }

  const borrarPromo = async (p: Promo) => {
    if (!confirm(`¿Borrar el código ${p.codigo}?`)) return
    setPromos(prev => prev.filter(x => x.id !== p.id))
    await fetch('/api/ecomm/promociones', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) }).catch(() => {})
  }

  const cargarArmazones = useCallback(async () => {
    setCargandoArm(true)
    try {
      const res = await fetch('/api/ecomm/armazones')
      const j = await res.json()
      setArmazones((j.ok ? j.armazones : []) as Armz[])
    } catch { setArmazones([]) } finally { setCargandoArm(false) }
  }, [])
  useEffect(() => { if (tab === 'inventario' && armazones.length === 0) cargarArmazones() }, [tab, armazones.length, cargarArmazones])

  const publicadoEn = (a: Armz) => tienda === 'gon' ? !!a.publicar_gon : !!a.publicar_verly
  const precioTienda = (a: Armz) => tienda === 'gon' ? Number(a.precio_gon || 0) : Number(a.precio || 0)
  const monedaTienda = tienda === 'gon' ? 'MXN' : 'USD'
  const armazonesFiltrados = armazones.filter(a => {
    if (soloPublicados && !publicadoEn(a)) return false
    const q = buscarArm.trim().toLowerCase()
    if (!q) return true
    return [a.sku, a.nombre, a.marca, a.modelo].some(v => (v ?? '').toLowerCase().includes(q))
  })

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
          { k: 'promos', label: 'Promociones', icon: Tag, activo: true },
          { k: 'inventario', label: 'Inventario web', icon: Box, activo: true },
          { k: 'finanzas', label: 'Finanzas', icon: BarChart3, activo: false },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.k} disabled={!t.activo} onClick={() => t.activo && setTab(t.k as 'pedidos' | 'clientes' | 'promos' | 'inventario')}
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

      {tab === 'promos' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-zinc-400">Cupones de descuento para la tienda en línea.</p>
            <button onClick={() => setMostrarFormPromo(v => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-[#0D9488] hover:opacity-80"><Plus className="w-3.5 h-3.5" /> Nuevo código</button>
          </div>

          {mostrarFormPromo && (
            <div className="bg-zinc-50 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">Código</label>
                  <input value={formPromo.codigo} onChange={e => setFormPromo(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="BIENVENIDO20" className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 uppercase" /></div>
                <div><label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">Tipo</label>
                  <select value={formPromo.tipo} onChange={e => setFormPromo(f => ({ ...f, tipo: e.target.value }))} className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none"><option value="porcentaje">Porcentaje (%)</option><option value="fijo">Monto fijo</option></select></div>
                <div><label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">Valor {formPromo.tipo === 'porcentaje' ? '(%)' : '(MXN)'}</label>
                  <input type="number" value={formPromo.valor} onChange={e => setFormPromo(f => ({ ...f, valor: e.target.value }))} placeholder={formPromo.tipo === 'porcentaje' ? '20' : '200'} className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" /></div>
                <div><label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">Compra mínima</label>
                  <input type="number" value={formPromo.minimo_compra} onChange={e => setFormPromo(f => ({ ...f, minimo_compra: e.target.value }))} placeholder="0 = sin mínimo" className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" /></div>
                <div><label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">Usos máximos</label>
                  <input type="number" value={formPromo.usos_maximos} onChange={e => setFormPromo(f => ({ ...f, usos_maximos: e.target.value }))} placeholder="vacío = ilimitado" className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" /></div>
                <div><label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">Expira</label>
                  <input type="date" value={formPromo.expires_at} onChange={e => setFormPromo(f => ({ ...f, expires_at: e.target.value }))} className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" /></div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setMostrarFormPromo(false)} className="px-3 py-1.5 border border-zinc-200 text-zinc-500 rounded text-sm hover:bg-zinc-100">Cancelar</button>
                <button onClick={crearPromo} disabled={guardandoPromo} className="px-4 py-1.5 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-600 disabled:opacity-50">{guardandoPromo ? 'Guardando…' : 'Crear'}</button>
              </div>
            </div>
          )}

          <div className="bg-white ring-1 ring-zinc-200 rounded-xl overflow-hidden">
            {cargandoPromo ? (
              <p className="text-center text-sm text-zinc-400 py-10">Cargando…</p>
            ) : promos.length === 0 ? (
              <p className="text-center text-sm text-zinc-400 py-10">Sin códigos todavía.</p>
            ) : promos.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-t border-zinc-50 first:border-t-0 text-sm">
                <span className="font-mono font-bold text-zinc-800">{p.codigo}</span>
                <span className="text-zinc-500 text-xs">{p.tipo === 'porcentaje' ? `${p.valor}%` : $$(p.valor)}{p.minimo_compra ? ` · mín ${$$(p.minimo_compra)}` : ''}{p.usos_maximos ? ` · ${p.usos ?? 0}/${p.usos_maximos} usos` : ''}</span>
                <span className="flex-1" />
                <button onClick={() => togglePromo(p)} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>{p.activo ? 'activo' : 'inactivo'}</button>
                <button onClick={() => borrarPromo(p)} className="text-zinc-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'inventario' && (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <input value={buscarArm} onChange={e => setBuscarArm(e.target.value)} placeholder="Buscar por SKU, nombre, marca…"
              className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 whitespace-nowrap cursor-pointer">
              <input type="checkbox" checked={!soloPublicados} onChange={e => setSoloPublicados(!e.target.checked)} className="w-3.5 h-3.5" />
              Ver no publicados
            </label>
          </div>
          <p className="text-[11px] text-zinc-400 mb-3">{soloPublicados ? `Solo los armazones en línea de ${tienda === 'gon' ? 'GON.mx' : 'Verly'}.` : 'Mostrando todo el catálogo. Publica uno para que aparezca en la tienda.'}</p>
          <div className="bg-white ring-1 ring-zinc-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_1.8fr_0.9fr_0.8fr] gap-2 px-4 py-2.5 bg-zinc-50 text-[10px] uppercase font-semibold text-zinc-400">
              <span>SKU</span><span>Armazón</span><span className="text-right">Precio {monedaTienda}</span><span className="text-center">En {tienda === 'gon' ? 'GON' : 'Verly'}</span>
            </div>
            {cargandoArm ? (
              <p className="text-center text-sm text-zinc-400 py-10">Cargando catálogo…</p>
            ) : armazonesFiltrados.length === 0 ? (
              <p className="text-center text-sm text-zinc-400 py-10">Sin armazones.</p>
            ) : armazonesFiltrados.slice(0, 100).map(a => (
              <button key={a.id} onClick={() => setSelArm(a)}
                className="w-full text-left grid grid-cols-[1fr_1.8fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-t border-zinc-50 text-sm items-center hover:bg-zinc-50 transition-colors">
                <span className="font-mono text-xs text-zinc-500">{a.sku}</span>
                <span className="text-zinc-700 truncate">{a.nombre || a.modelo || '—'}<span className="block text-[11px] text-zinc-400">{[a.marca, a.forma, a.genero].filter(Boolean).join(' · ')}</span></span>
                <span className="text-right font-semibold text-zinc-800">{$$(precioTienda(a))}</span>
                <span className="text-center">{publicadoEn(a) ? <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">sí</span> : <span className="text-[11px] text-zinc-400">no</span>}</span>
              </button>
            ))}
          </div>
          {armazonesFiltrados.length > 100 && <p className="text-[11px] text-zinc-400 mt-2 text-center">Mostrando 100 de {armazonesFiltrados.length}. Busca para acotar.</p>}
        </div>
      )}

      {selArm && <ArmzEditor armz={selArm} tienda={tienda} onClose={() => setSelArm(null)} onSaved={(aa) => { setArmazones(prev => prev.map(x => x.id === aa.id ? aa : x)); setSelArm(null) }} />}

      {sel && <DetallePedido pedido={sel} tienda={tienda} onClose={() => setSel(null)}
        onSaved={(pp) => { setPedidos(prev => prev.map(x => x.id === pp.id ? pp : x)); setSel(pp) }}
        onDeleted={(idp) => { setPedidos(prev => prev.filter(x => x.id !== idp)); setSel(null) }} />}
    </div>
  )
}

const FORMAS_OPC = ['redonda', 'cuadrada', 'rectangular', 'ovalada', 'aviador']
const GENEROS_OPC = ['hombre', 'mujer', 'unisex']
const MATERIALES_OPC = ['Acetato', 'Metálico', 'TR-90', 'Titanio', 'Mixto']
const BADGE_OPC = ['Nuevo', 'Popular', 'Más vendido', 'Oferta']

function ArmzEditor({ armz, tienda, onClose, onSaved }: { armz: Armz; tienda: 'verly' | 'gon'; onClose: () => void; onSaved: (a: Armz) => void }) {
  const [f, setF] = useState({
    nombre: armz.nombre ?? '', marca: armz.marca ?? '', modelo: armz.modelo ?? '',
    forma: armz.forma ?? '', genero: armz.genero ?? '', color1: armz.color1 ?? '', material: armz.material ?? '', medidas: armz.medidas ?? '',
    badge: armz.badge ?? '',
    precio: String((tienda === 'gon' ? armz.precio_gon : armz.precio) ?? ''),
    descuento: String((tienda === 'gon' ? armz.descuento_gon : armz.descuento_verly) ?? ''),
    publicar: tienda === 'gon' ? !!armz.publicar_gon : !!armz.publicar_verly,
  })
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }))
  const campo = (label: string, k: keyof typeof f, ph = '') => (
    <div><label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">{label}</label>
      <input value={f[k] as string} onChange={e => set(k, e.target.value)} placeholder={ph}
        className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" /></div>
  )
  const menu = (label: string, k: keyof typeof f, opciones: string[]) => {
    const actual = String(f[k] ?? '')
    const opts = actual && !opciones.includes(actual) ? [actual, ...opciones] : opciones
    return (
      <div><label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">{label}</label>
        <select value={actual} onChange={e => set(k, e.target.value)}
          className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 capitalize">
          <option value="">— sin definir —</option>
          {opts.map(o => <option key={o} value={o} className="capitalize">{o}</option>)}
        </select></div>
    )
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const cambios: Record<string, unknown> = {
        id: armz.id, nombre: f.nombre, marca: f.marca, modelo: f.modelo,
        forma: f.forma, genero: f.genero, color1: f.color1, material: f.material, medidas: f.medidas,
        badge: f.badge,
      }
      if (tienda === 'gon') { cambios.precio_gon = Number(f.precio) || 0; cambios.descuento_gon = Number(f.descuento) || 0; cambios.publicar_gon = f.publicar }
      else { cambios.precio = Number(f.precio) || 0; cambios.descuento_verly = Number(f.descuento) || 0; cambios.publicar_verly = f.publicar }
      const res = await fetch('/api/ecomm/armazones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      onSaved(j.armazon as Armz)
    } catch (e) { alert('No se pudo guardar: ' + (e instanceof Error ? e.message : '')) } finally { setGuardando(false) }
  }

  const fotos = [armz.imagen_url, armz.imagen2_url, armz.imagen3_url, armz.imagen4_url, armz.imagen5_url].filter(Boolean) as string[]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 sticky top-0 bg-white">
          <div><p className="font-mono text-xs text-zinc-400">{armz.sku}</p><p className="text-base font-bold text-zinc-800">Editar para {tienda === 'gon' ? 'GON.mx' : 'Verly'}</p></div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {fotos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">{fotos.map((src, i) => <img key={i} src={src} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0 ring-1 ring-zinc-100" />)}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {campo('Nombre / apodo', 'nombre')}
            {campo('Marca', 'marca')}
            {campo('Modelo', 'modelo')}
            {menu('Forma', 'forma', FORMAS_OPC)}
            {menu('Género', 'genero', GENEROS_OPC)}
            {campo('Color', 'color1')}
            {menu('Material', 'material', MATERIALES_OPC)}
            {campo('Medidas', 'medidas')}
            {menu('Etiqueta / badge', 'badge', BADGE_OPC)}
          </div>
          <div className="border-t border-zinc-100 pt-3 grid grid-cols-2 gap-3">
            {campo(`Precio (${tienda === 'gon' ? 'MXN' : 'USD'})`, 'precio')}
            {campo('Descuento (%)', 'descuento')}
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={f.publicar} onChange={e => set('publicar', e.target.checked)} className="w-4 h-4" />
            Publicar en {tienda === 'gon' ? 'GON.mx' : 'Verly'}
          </label>
        </div>
        <div className="px-5 py-4 border-t border-zinc-100 flex gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 py-2 border border-zinc-200 text-zinc-600 rounded text-sm font-semibold hover:bg-zinc-100">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-600 disabled:opacity-50"><Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function DetallePedido({ pedido, tienda, onClose, onSaved, onDeleted }: { pedido: Pedido; tienda: string; onClose: () => void; onSaved: (p: Pedido) => void; onDeleted: (id: number) => void }) {
  const [estado, setEstado] = useState(pedido.estado)
  const [paqueteria, setPaqueteria] = useState(pedido.paqueteria ?? '')
  const [tracking, setTracking] = useState(pedido.tracking ?? '')
  const [notas, setNotas] = useState(pedido.notas_admin ?? '')
  const [guardando, setGuardando] = useState(false)

  const borrar = async () => {
    if (!confirm(`¿Borrar el pedido ${folioDe(pedido.id, tienda)}? Es permanente (úsalo solo para pruebas).`)) return
    const res = await fetch('/api/ecomm/pedidos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pedido.id }) })
    const j = await res.json()
    if (!j.ok) { alert('No se pudo borrar: ' + j.error); return }
    onDeleted(pedido.id)
  }
  const c = pedido.clientes
  const a = pedido.armazones

  const ESTADOS_CORREO = ['en proceso', 'enviado', 'entregado']
  const cambioEstado = estado !== pedido.estado
  const notificara = cambioEstado && ESTADOS_CORREO.includes(estado)

  const guardar = async () => {
    if (notificara && estado === 'enviado' && !tracking.trim()) {
      alert('Para avisar al cliente que se envió, pon el número de guía.')
      return
    }
    setGuardando(true)
    try {
      const res = await fetch('/api/ecomm/pedidos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pedido.id, estado, paqueteria, tracking, notas_admin: notas }),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')

      // Avisar al cliente por correo si el estado cambió a uno notificable
      if (notificara) {
        const rn = await fetch('/api/ecomm/pedido-notificar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pedido.id, estado, tienda, tracking, paqueteria }),
        })
        const jn = await rn.json().catch(() => ({ ok: false }))
        if (!jn.ok) alert('El pedido se guardó, pero el correo al cliente no salió: ' + (jn.error || 'error') + '\nRevisa e inténtalo de nuevo.')
      }

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
            {notificara && (
              <p className="text-[11px] text-teal-700 bg-teal-50 rounded px-2.5 py-1.5 mt-2 flex items-center gap-1"><Mail className="w-3 h-3" /> Al guardar se le avisará al cliente por correo ({estado}).</p>
            )}
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

        <div className="px-5 py-4 border-t border-zinc-100 flex items-center gap-2 sticky bottom-0 bg-white">
          <button onClick={borrar} title="Borrar pedido (pruebas)" className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
