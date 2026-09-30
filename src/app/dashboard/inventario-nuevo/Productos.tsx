'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Loader2, X, Save, ArrowRight } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Catálogo: Micas y tratamientos · Lentes de contacto · Consumibles · Servicios
// Cada óptica arma el suyo. El costo solo lo ve el administrador.
// ─────────────────────────────────────────────────────────────

type Opcion = { color: string; extra: number; micas: string[] }
type Prod = {
  id: number; sku: string; nombre: string; marca: string | null; precio: number; costo: number | null; activo: boolean
  grupo: string; vision: string | null; control_stock: boolean | null; genera_lab: boolean | null
  opciones: Opcion[] | null; extra_mica: Record<string, number> | null
  paquete: { mica: string | null; tratamientos: string[]; armazon: boolean } | null
  padre: string | null; stock_baja: number | null; stock_mayo: number | null; stock_plaza: number | null; stock_bodega: number | null; stock_min: number | null
}
type LentePedido = { id: string; nombre: string; precio_publico: number; activo: boolean }
export type Seccion = 'micas' | 'lc' | 'consumibles' | 'servicios'

const UB = [
  { k: 'baja', col: 'stock_baja', label: 'Baja Visión', corto: 'Baja' },
  { k: 'mayo', col: 'stock_mayo', label: '5 de Mayo', corto: 'Mayo' },
  { k: 'plaza', col: 'stock_plaza', label: 'Plaza Laureles', corto: 'Plaza' },
  { k: 'bodega', col: 'stock_bodega', label: 'Bodega', corto: 'Bodega' },
] as const
const n = (v: unknown) => Number(v ?? 0) || 0
const $ = (v: number) => '$' + Math.round(v).toLocaleString('es-MX')
const nomMica = (p: Prod) => p.nombre.replace(/^mica\s+(monofocal|bifocal|progresivo)\s+/i, '')
const stockDe = (p: Prod) => UB.map(u => n(p[u.col]))
const inp = 'mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-zinc-50'
const lbl = 'block text-[11px] font-semibold text-zinc-500'

type Item = Prod | LentePedido
function Th({ children, r }: { children?: React.ReactNode; r?: boolean }) { return <th className={`${r ? 'text-right' : 'text-left'} font-semibold px-4 py-2`}>{children}</th> }
function Tabla({ children }: { children: React.ReactNode }) { return <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto"><table className="w-full text-sm">{children}</table></div> }
function Vacio({ cols }: { cols: number }) { return <tr><td colSpan={cols} className="text-center text-zinc-400 py-10">Sin productos. Usa “Agregar”.</td></tr> }
function Fila({ p, children }: { p: { activo: boolean }; children: React.ReactNode }) { return <tr className={`border-b border-zinc-100 ${p.activo ? '' : 'opacity-45'}`}>{children}</tr> }
function CostoTh({ esAdmin }: { esAdmin: boolean }) { return esAdmin ? <th className="text-right font-semibold px-4 py-2">Costo</th> : null }
function CostoTd({ p, esAdmin }: { p: { costo?: number | null }; esAdmin: boolean }) {
  return esAdmin ? <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{n(p.costo) ? $(n(p.costo)) : <span className="text-[11px]">sin capturar</span>}</td> : null
}
function Acciones({ item, tipo, onEdit, onToggle }: { item: Item; tipo: string; onEdit: (m: { tipo: string; item: Item }) => void; onToggle: (i: Item) => void }) {
  return (
    <td className="px-4 py-2.5 text-right whitespace-nowrap">
      <button onClick={() => onEdit({ tipo, item })} className="text-xs font-semibold text-teal-700 hover:underline mr-3">Editar</button>
      <button onClick={() => onToggle(item)} className="text-xs font-semibold text-zinc-500 hover:underline">{item.activo ? 'Desactivar' : 'Activar'}</button>
    </td>
  )
}

async function api(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
  const j = await fetch('/api/inv/productos', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json()).catch(() => ({ ok: false, error: 'Sin conexión' }))
  if (!j.ok) throw new Error(j.error || 'Error')
  return j
}

export default function Catalogo({ seccion, esAdmin }: { seccion: Seccion; esAdmin: boolean }) {
  const [prods, setProds] = useState<Prod[]>([])
  const [lentesPedido, setLentesPedido] = useState<LentePedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [verInact, setVerInact] = useState(false)
  const [sub, setSub] = useState<'mica' | 'tratamiento' | 'paquete'>('mica')
  const [modal, setModal] = useState<null | { tipo: string; item?: Prod | LentePedido }>(null)

  const cargar = useCallback(async () => {
    const j = await fetch('/api/inv/productos', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false }))
    if (j.ok) { setProds(j.productos); setLentesPedido(j.lentesPedido) } else setMsg('No se pudo cargar: ' + (j.error ?? ''))
    setCargando(false)
  }, [])
  useEffect(() => { const t = setTimeout(cargar, 0); return () => clearTimeout(t) }, [cargar])

  const t = q.trim().toLowerCase()
  const filtra = <T extends { nombre: string; activo: boolean }>(L: T[]) => L.filter(x => (verInact || x.activo) && (!t || x.nombre.toLowerCase().includes(t)))
  const de = (grupo: string) => prods.filter(p => p.grupo === grupo)
  const micas = de('mica'), trats = de('tratamiento'), paqs = de('paquete')
  const toggle = async (item: Prod | LentePedido) => {
    try {
      await api('PATCH', { id: item.id, activo: !item.activo, ...('precio_publico' in item ? { tabla: 'lc_pedido' } : {}) })
      setMsg(item.activo ? `“${item.nombre}” desactivado: ya no aparece al vender (no se borra).` : `“${item.nombre}” activado.`); cargar()
    } catch (e) { setMsg('No se pudo: ' + (e as Error).message) }
  }
  const listo = (m: string) => { setModal(null); setMsg(m); cargar() }

  const barra = (agregar: { label: string; tipo: string }[], extra?: React.ReactNode, ayuda?: string) => (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg px-3 py-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-zinc-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className="flex-1 text-sm bg-transparent focus:outline-none" />
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={verInact} onChange={e => setVerInact(e.target.checked)} /> Ver desactivados</label>
        {extra}
        {agregar.map(a => (
          <button key={a.tipo} onClick={() => setModal({ tipo: a.tipo })} className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27]">
            <Plus className="w-4 h-4" /> {a.label}
          </button>
        ))}
      </div>
      {ayuda && <p className="text-xs text-zinc-400">{ayuda}</p>}
    </>
  )
  const botonMov = (label: string, tipo: string) => (
    <button onClick={() => setModal({ tipo })} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm font-semibold bg-white hover:bg-zinc-50">{label}</button>
  )

  if (cargando) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>

  return (
    <div className="space-y-4">
      {msg && <div className="text-sm px-4 py-2.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 flex justify-between gap-3">{msg}<button onClick={() => setMsg('')} className="text-zinc-400"><X className="w-4 h-4" /></button></div>}

      {/* ── MICAS Y TRATAMIENTOS ── */}
      {seccion === 'micas' && <>
        <div className="flex gap-2">
          {([['mica', 'Micas'], ['tratamiento', 'Tratamientos'], ['paquete', 'Paquetes']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSub(k)} className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${sub === k ? 'bg-[#0B0E14] text-white border-[#0B0E14]' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}>{l}</button>
          ))}
        </div>
        {sub === 'mica' && <>
          {barra([{ label: 'Agregar mica', tipo: 'mica' }], null, 'Sin stock: todas se piden al laboratorio.')}
          {(['Monofocal', 'Bifocal', 'Progresivo'] as const).map(v => {
            const L = filtra(micas.filter(m => (m.vision ?? 'Monofocal') === v))
            if (!L.length) return null
            return (
              <div key={v}>
                <div className="text-xs font-semibold text-zinc-500 mb-1.5">{v}</div>
                <Tabla>
                  <thead><tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200"><Th>Mica</Th><Th>Marca</Th><Th>SKU</Th><Th r>Precio</Th><CostoTh esAdmin={esAdmin} /><th /></tr></thead>
                  <tbody>{L.map(p => <Fila key={p.id} p={p}>
                    <td className="px-4 py-2.5">{nomMica(p)}</td><td className="px-4 py-2.5 text-zinc-500">{p.marca && p.marca !== 'GON' ? p.marca : '–'}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-400">{p.sku}</td><td className="px-4 py-2.5 text-right tabular-nums">{$(n(p.precio))}</td><CostoTd p={p} esAdmin={esAdmin} /><Acciones item={p} tipo="mica" onEdit={setModal} onToggle={toggle} />
                  </Fila>)}</tbody>
                </Tabla>
              </div>
            )
          })}
          {filtra(micas).length === 0 && <Tabla><tbody><Vacio cols={5} /></tbody></Tabla>}
        </>}
        {sub === 'tratamiento' && <>
          {barra([{ label: 'Agregar tratamiento', tipo: 'tratamiento' }], null, 'Antirreflejante, blue, fotocromático, tinte… Si tiene colores, cada color dice en qué micas existe.')}
          <Tabla>
            <thead><tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200"><Th>Tratamiento</Th><Th>Colores</Th><Th>SKU</Th><Th r>Precio</Th><CostoTh esAdmin={esAdmin} /><th /></tr></thead>
            <tbody>{filtra(trats).map(p => <Fila key={p.id} p={p}>
              <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
              <td className="px-4 py-2.5">{p.opciones?.length ? p.opciones.map(o => <span key={o.color} className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 mr-1 mb-1">{o.color}{o.extra ? ` +${$(o.extra)}` : ''}</span>) : <span className="text-zinc-300">–</span>}</td>
              <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-400">{p.sku}</td><td className="px-4 py-2.5 text-right tabular-nums">{$(n(p.precio))}</td><CostoTd p={p} esAdmin={esAdmin} /><Acciones item={p} tipo="tratamiento" onEdit={setModal} onToggle={toggle} />
            </Fila>)}{filtra(trats).length === 0 && <Vacio cols={6} />}</tbody>
          </Tabla>
        </>}
        {sub === 'paquete' && <>
          {barra([{ label: 'Agregar paquete', tipo: 'paquete' }], null, 'Precio cerrado armado con tus micas y tratamientos. La orden de laboratorio se llena sola.')}
          <Tabla>
            <thead><tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200"><Th>Paquete</Th><Th>Incluye</Th><Th r>Por separado</Th><Th r>Precio paquete</Th><th /></tr></thead>
            <tbody>{filtra(paqs).map(p => {
              const m = micas.find(x => x.sku === p.paquete?.mica)
              const ts = (p.paquete?.tratamientos ?? []).map(s => trats.find(x => x.sku === s)).filter(Boolean) as Prod[]
              const sep = n(m?.precio) + ts.reduce((a, x) => a + n(x.precio), 0)
              return <Fila key={p.id} p={p}>
                <td className="px-4 py-2.5 font-medium max-w-xs">{p.nombre}<div className="font-mono text-[11px] text-zinc-400">{p.sku}</div></td>
                <td className="px-4 py-2.5">
                  {m ? <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 mr-1 mb-1">{m.vision} {nomMica(m)}</span> : <span className="text-[11px] text-amber-600">Sin mica</span>}
                  {ts.map(x => <span key={x.sku} className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 mr-1 mb-1">{x.nombre}</span>)}
                  {p.paquete?.armazon && <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">+ armazón</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{m ? $(sep) : '–'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{$(n(p.precio))}{m && sep > n(p.precio) && <div className="text-[11px] text-emerald-600 font-semibold">ahorra {$(sep - n(p.precio))}</div>}</td>
                <Acciones item={p} tipo="paquete" onEdit={setModal} onToggle={toggle} />
              </Fila>
            })}{filtra(paqs).length === 0 && <Vacio cols={5} />}</tbody>
          </Tabla>
          <p className="text-[11px] text-zinc-400">Los cambios a paquetes y a los colores de los tratamientos se reflejan en la venta cuando conectemos el POS (Parte 2).</p>
        </>}
      </>}

      {/* ── LENTES DE CONTACTO ── */}
      {seccion === 'lc' && <>
        {barra([{ label: 'Agregar lente de contacto', tipo: 'lc' }], <>{botonMov('+ Entrada', 'entrada_lc')}{botonMov('⇄ Traspasar', 'traspaso_lc')}</>,
          'En stock: con graduaciones y piezas por óptica. Sobre pedido: se vende y se pide al laboratorio.')}
        <Tabla>
          <thead><tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200"><Th>Lente de contacto</Th><Th>Forma</Th><Th>Graduaciones en stock</Th><Th r>Precio</Th><CostoTh esAdmin={esAdmin} /><th /></tr></thead>
          <tbody>
            {filtra(de('lc')).map(p => {
              const grads = de('lc_grad').filter(g => g.padre === p.sku && g.activo)
              return <Fila key={p.id} p={p}>
                <td className="px-4 py-2.5 font-medium">{p.nombre}<div className="font-mono text-[11px] text-zinc-400">{p.sku}</div></td>
                <td className="px-4 py-2.5"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">En stock</span></td>
                <td className="px-4 py-2.5">{grads.length ? grads.map(g => {
                  const s = stockDe(g); const tot = s.reduce((a, b) => a + b, 0)
                  return <span key={g.id} title={UB.map((u, i) => `${u.corto} ${s[i]}`).join(' · ')} className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mr-1 mb-1 ${tot ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-400'}`}>{g.nombre.replace(p.nombre, '').trim()} · {tot}</span>
                }) : <span className="text-[11px] text-zinc-400">Sin graduaciones: dales entrada</span>}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{$(n(p.precio))}</td><CostoTd p={p} esAdmin={esAdmin} /><Acciones item={p} tipo="lc_stock" onEdit={setModal} onToggle={toggle} />
              </Fila>
            })}
            {filtra(lentesPedido).map(l => <Fila key={l.id} p={l}>
              <td className="px-4 py-2.5 font-medium">{l.nombre}</td>
              <td className="px-4 py-2.5"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">Sobre pedido</span></td>
              <td className="px-4 py-2.5 text-[11px] text-zinc-400">Se pide al laboratorio</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{$(n(l.precio_publico))}</td>{esAdmin && <td className="px-4 py-2.5 text-right text-[11px] text-zinc-300">–</td>}<Acciones item={l} tipo="lc_pedido" onEdit={setModal} onToggle={toggle} />
            </Fila>)}
            {!filtra(de('lc')).length && !filtra(lentesPedido).length && <Vacio cols={6} />}
          </tbody>
        </Tabla>
      </>}

      {/* ── CONSUMIBLES ── */}
      {seccion === 'consumibles' && <>
        {barra([{ label: 'Agregar consumible', tipo: 'consumible' }], <>{botonMov('+ Entrada', 'entrada_cons')}{botonMov('⇄ Traspasar', 'traspaso_cons')}</>,
          'Con control de stock: piezas por óptica y alerta cuando baja del mínimo. Sin control (tornillos, plaquetas): solo precio.')}
        <Tabla>
          <thead><tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200"><Th>Consumible</Th><Th r>Precio</Th><CostoTh esAdmin={esAdmin} />{UB.map(u => <Th key={u.k} r>{u.corto}</Th>)}<Th r>Mínimo</Th><th /></tr></thead>
          <tbody>{filtra(de('consumible')).map(p => {
            const s = stockDe(p)
            return <Fila key={p.id} p={p}>
              <td className="px-4 py-2.5 font-medium">{p.nombre}<div className="font-mono text-[11px] text-zinc-400">{p.sku}</div></td>
              <td className="px-4 py-2.5 text-right tabular-nums">{$(n(p.precio))}</td><CostoTd p={p} esAdmin={esAdmin} />
              {p.control_stock !== false
                ? <>{s.map((x, i) => <td key={i} className={`px-3 py-2.5 text-right tabular-nums ${i < 3 && x < n(p.stock_min) ? 'text-red-600 font-semibold' : ''}`}>{x}</td>)}<td className="px-3 py-2.5 text-right text-zinc-400">{n(p.stock_min)}</td></>
                : <td colSpan={5} className="px-3 py-2.5 text-center text-[11px] text-zinc-400">Sin control de stock · solo precio</td>}
              <Acciones item={p} tipo="consumible" onEdit={setModal} onToggle={toggle} />
            </Fila>
          })}{filtra(de('consumible')).length === 0 && <Vacio cols={9} />}</tbody>
        </Tabla>
      </>}

      {/* ── SERVICIOS ── */}
      {seccion === 'servicios' && <>
        {barra([{ label: 'Agregar servicio', tipo: 'servicio' }], null, 'Precio fijo. “Genera orden de laboratorio” crea su nota de lab al venderse (ej. rebisel).')}
        <Tabla>
          <thead><tr className="text-[11px] text-zinc-500 bg-zinc-50 border-b border-zinc-200"><Th>Servicio</Th><Th>SKU</Th><Th r>Precio</Th><CostoTh esAdmin={esAdmin} /><Th>Laboratorio</Th><th /></tr></thead>
          <tbody>{filtra(de('servicio')).map(p => <Fila key={p.id} p={p}>
            <td className="px-4 py-2.5 font-medium">{p.nombre}</td><td className="px-4 py-2.5 font-mono text-[11px] text-zinc-400">{p.sku}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{$(n(p.precio))}</td><CostoTd p={p} esAdmin={esAdmin} />
            <td className="px-4 py-2.5">{p.genera_lab ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Genera orden de lab</span> : <span className="text-zinc-300">–</span>}</td>
            <Acciones item={p} tipo="servicio" onEdit={setModal} onToggle={toggle} />
          </Fila>)}{filtra(de('servicio')).length === 0 && <Vacio cols={6} />}</tbody>
        </Tabla>
      </>}

      {modal && <Modal tipo={modal.tipo} item={modal.item} esAdmin={esAdmin} prods={prods} onClose={() => setModal(null)} onDone={listo} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Formularios
// ─────────────────────────────────────────────────────────────
function Modal({ tipo, item, esAdmin, prods, onClose, onDone }: {
  tipo: string; item?: Prod | LentePedido; esAdmin: boolean; prods: Prod[]; onClose: () => void; onDone: (m: string) => void
}) {
  const p = item && !('precio_publico' in item) ? item : null
  const lp = item && 'precio_publico' in item ? item : null
  const micas = prods.filter(x => x.grupo === 'mica' && x.activo)
  const trats = prods.filter(x => x.grupo === 'tratamiento' && x.activo)
  const [f, setF] = useState({
    nombre: p ? (p.grupo === 'mica' ? nomMica(p) : p.nombre) : lp?.nombre ?? '',
    marca: p?.marca && p.marca !== 'GON' ? p.marca : '',
    precio: p ? String(n(p.precio)) : lp ? String(lp.precio_publico) : '',
    costo: p?.costo ? String(p.costo) : '',
    vision: p?.vision ?? 'Monofocal',
    forma: 'pedido' as 'pedido' | 'stock',
    control: p ? p.control_stock !== false : true,
    lab: !!p?.genera_lab,
    min: String(n(p?.stock_min)),
    s: [0, 0, 0, 0],
    pMica: p?.paquete?.mica ?? '', pTrat: p?.paquete?.tratamientos ?? [], pArm: p?.paquete?.armazon ?? true,
  })
  const [colores, setColores] = useState<Opcion[]>(p?.opciones ?? [])
  const [tieneColores, setTieneColores] = useState(!!p?.opciones?.length)
  const [extraMica, setExtraMica] = useState<[string, string][]>(Object.entries(p?.extra_mica ?? {}).map(([k, v]) => [k, String(v)]))
  // movimientos
  const conStock = tipo.endsWith('_lc') ? prods.filter(x => x.grupo === 'lc_grad' && x.activo) : prods.filter(x => x.grupo === 'consumible' && x.activo && x.control_stock !== false)
  const lcs = prods.filter(x => x.grupo === 'lc' && x.activo)
  const [mv, setMv] = useState({ id: '', lc: lcs[0]?.sku ?? '', grad: '', nuevaGrad: '', desde: 'bodega', hacia: 'baja', cant: '1' })
  const [err, setErr] = useState('')
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof typeof f, v: unknown) => setF(x => ({ ...x, [k]: v }))

  const esMov = tipo.startsWith('entrada') || tipo.startsWith('traspaso')
  const titulo = esMov
    ? (tipo.startsWith('entrada') ? 'Entrada' : 'Traspaso') + (tipo.endsWith('_lc') ? ' de lentes de contacto' : ' de consumibles')
    : (item ? 'Editar ' : 'Agregar ') + ({ mica: 'mica', tratamiento: 'tratamiento', paquete: 'paquete', lc: 'lente de contacto', lc_stock: 'lente de contacto', lc_pedido: 'lente de contacto', consumible: 'consumible', servicio: 'servicio' } as Record<string, string>)[tipo]

  const pm = micas.find(m => m.sku === f.pMica)
  const sep = n(pm?.precio) + f.pTrat.reduce((a, s) => a + n(trats.find(t => t.sku === s)?.precio), 0)

  const guardar = async () => {
    setErr(''); setGuardando(true)
    try {
      if (esMov) {
        const cant = parseInt(mv.cant) || 0
        if (cant <= 0) throw new Error('Pon la cantidad')
        let id = mv.id
        if (tipo === 'entrada_lc') {
          if (!mv.lc) throw new Error('Primero agrega un lente de contacto en stock')
          if (mv.grad === 'nueva') {
            if (!mv.nuevaGrad.trim()) throw new Error('Escribe la graduación, ej. -2.75')
            const j = await api('POST', { accion: 'crear', grupo: 'lc_grad', padre: mv.lc, nombre: mv.nuevaGrad.trim() })
            id = String(j.producto.id)
          } else id = mv.grad
        }
        if (!id) throw new Error('Elige el producto')
        const tras = tipo.startsWith('traspaso')
        if (tras && mv.desde === mv.hacia) throw new Error('Elige dos ubicaciones distintas')
        await api('POST', { accion: 'mover', id: Number(id), cantidad: cant, hacia: mv.hacia, ...(tras ? { desde: mv.desde } : {}) })
        onDone(tras ? `Traspaso hecho: ${cant} de ${UB.find(u => u.k === mv.desde)?.label} a ${UB.find(u => u.k === mv.hacia)?.label}.` : `Entrada registrada: +${cant} en ${UB.find(u => u.k === mv.hacia)?.label}.`)
        return
      }
      if (!f.nombre.trim()) throw new Error('Falta el nombre')
      if (tipo !== 'lc_stock' && f.precio === '') throw new Error('Falta el precio')
      const base: Record<string, unknown> = { nombre: f.nombre, precio: Number(f.precio) || 0, ...(esAdmin ? { costo: Number(f.costo) || 0 } : {}) }
      if (tipo === 'mica') Object.assign(base, { marca: f.marca, vision: f.vision })
      if (tipo === 'tratamiento') Object.assign(base, {
        opciones: tieneColores ? colores.filter(c => c.color.trim()).map(c => ({ ...c, color: c.color.trim() })) : null,
        extra_mica: tieneColores && extraMica.length ? Object.fromEntries(extraMica.filter(([k, v]) => k && v).map(([k, v]) => [k, Number(v)])) : null,
      })
      if (tipo === 'paquete') {
        if (!f.pMica) throw new Error('Elige la mica del paquete')
        base.paquete = { mica: f.pMica, tratamientos: f.pTrat, armazon: f.pArm }
      }
      if (tipo === 'servicio') base.genera_lab = f.lab
      if (tipo === 'consumible') Object.assign(base, { control_stock: f.control, stock_min: Number(f.min) || 0, marca: f.marca },
        !item && f.control ? { stock_baja: f.s[0], stock_mayo: f.s[1], stock_plaza: f.s[2], stock_bodega: f.s[3] } : {})

      if (item) {
        const body = lp ? { id: lp.id, tabla: 'lc_pedido', nombre: f.nombre, precio: Number(f.precio) || 0 } : { id: p!.id, ...base }
        if (p?.grupo === 'mica') (body as Record<string, unknown>).nombre = `Mica ${f.vision} ${f.nombre}`
        await api('PATCH', body)
        onDone('Cambios guardados.')
      } else {
        const grupo = tipo === 'lc' ? (f.forma === 'stock' ? 'lc' : 'lc_pedido') : tipo
        const j = await api('POST', { accion: 'crear', grupo, ...base })
        onDone(`Agregado${j.producto?.sku ? ` con SKU ${j.producto.sku}` : ''}.`)
      }
    } catch (e) { setErr((e as Error).message) }
    finally { setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-zinc-900">{titulo}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3">
          {esMov ? <>
            {tipo === 'entrada_lc' ? <>
              <label className={lbl + ' col-span-2'}>Lente de contacto
                <select value={mv.lc} onChange={e => setMv(v => ({ ...v, lc: e.target.value, grad: '' }))} className={inp}>
                  {lcs.length ? lcs.map(l => <option key={l.sku} value={l.sku}>{l.nombre}</option>) : <option value="">Primero agrega uno “En stock”</option>}
                </select></label>
              <label className={lbl}>Graduación
                <select value={mv.grad} onChange={e => setMv(v => ({ ...v, grad: e.target.value }))} className={inp}>
                  <option value="">Elige…</option>
                  {conStock.filter(g => g.padre === mv.lc).map(g => <option key={g.id} value={g.id}>{g.nombre.replace(lcs.find(l => l.sku === mv.lc)?.nombre ?? '', '').trim()}</option>)}
                  <option value="nueva">+ Graduación nueva</option>
                </select></label>
              {mv.grad === 'nueva' && <label className={lbl}>Graduación nueva<input value={mv.nuevaGrad} onChange={e => setMv(v => ({ ...v, nuevaGrad: e.target.value }))} placeholder="-2.75" className={inp} /></label>}
            </> : (
              <label className={lbl + ' col-span-2'}>Producto
                <select value={mv.id} onChange={e => setMv(v => ({ ...v, id: e.target.value }))} className={inp}>
                  <option value="">Elige…</option>
                  {conStock.map(x => <option key={x.id} value={x.id}>{x.nombre} · {UB.map((u, i) => `${u.corto} ${stockDe(x)[i]}`).join(' · ')}</option>)}
                </select></label>
            )}
            {tipo.startsWith('traspaso') && (
              <label className={lbl}>Sale de<select value={mv.desde} onChange={e => setMv(v => ({ ...v, desde: e.target.value }))} className={inp}>{UB.map(u => <option key={u.k} value={u.k}>{u.label}</option>)}</select></label>
            )}
            <label className={lbl}>{tipo.startsWith('traspaso') ? 'Va a' : '¿A dónde entra?'}<select value={mv.hacia} onChange={e => setMv(v => ({ ...v, hacia: e.target.value }))} className={inp}>{UB.map(u => <option key={u.k} value={u.k}>{u.label}</option>)}</select></label>
            <label className={lbl}>Cantidad<input type="number" min={1} value={mv.cant} onChange={e => setMv(v => ({ ...v, cant: e.target.value }))} className={inp} /></label>
            {tipo.startsWith('traspaso') && <p className="col-span-2 text-[11px] text-zinc-400 flex items-center gap-1">Se mueve al momento <ArrowRight className="w-3 h-3" /> la otra óptica ya lo ve en su stock.</p>}
          </> : <>
            {tipo === 'mica' && <label className={lbl + ' col-span-2'}>Visión
              <select value={f.vision} onChange={e => set('vision', e.target.value)} className={inp}><option>Monofocal</option><option>Bifocal</option><option>Progresivo</option></select></label>}
            {tipo === 'lc' && <label className={lbl + ' col-span-2'}>Forma
              <select value={f.forma} onChange={e => set('forma', e.target.value)} className={inp}>
                <option value="pedido">Sobre pedido (se vende y se pide al laboratorio)</option>
                <option value="stock">En stock (con graduaciones y piezas por óptica)</option>
              </select></label>}
            <label className={lbl + ' col-span-2'}>Nombre
              <input value={f.nombre} onChange={e => set('nombre', e.target.value)} className={inp}
                placeholder={({ mica: 'Policarbonato 1.59 · CR-39 1.56 · Varilux X…', tratamiento: 'Espejeado', paquete: 'Paquete Monofocal Blue', lc: 'Acuvue Oasys caja 6', consumible: 'Spray limpiador 60 ml', servicio: 'Soldadura de armazón' } as Record<string, string>)[tipo] ?? ''} /></label>
            {(tipo === 'mica' || tipo === 'consumible') && <label className={lbl}>Marca (opcional)<input value={f.marca} onChange={e => set('marca', e.target.value)} className={inp} placeholder="Essilor, Kodak…" /></label>}
            <label className={lbl}>{tipo === 'paquete' ? 'Precio del paquete' : 'Precio al público'}<input type="number" value={f.precio} onChange={e => set('precio', e.target.value)} className={inp} /></label>
            {esAdmin && tipo !== 'paquete' && tipo !== 'lc_pedido' && !(tipo === 'lc' && f.forma === 'pedido') &&
              <label className={lbl}>Costo (solo tú lo ves)<input type="number" value={f.costo} onChange={e => set('costo', e.target.value)} className={inp} placeholder="Lo que te cuesta" /></label>}

            {tipo === 'servicio' && <label className="col-span-2 flex items-center gap-2 text-sm border border-zinc-200 rounded-lg px-3 py-2.5"><input type="checkbox" checked={f.lab} onChange={e => set('lab', e.target.checked)} /> Genera orden de laboratorio (ej. rebisel)</label>}

            {tipo === 'consumible' && <>
              <label className="col-span-2 flex items-center gap-2 text-sm border border-zinc-200 rounded-lg px-3 py-2.5"><input type="checkbox" checked={f.control} onChange={e => set('control', e.target.checked)} /> Llevar control de stock (quítalo para tornillos, plaquetas…)</label>
              {f.control && <>
                {!item && UB.map((u, i) => <label key={u.k} className={lbl}>{u.label} (inicial)<input type="number" min={0} value={f.s[i]} onChange={e => set('s', f.s.map((x, j) => j === i ? Math.max(0, +e.target.value || 0) : x))} className={inp} /></label>)}
                <label className={lbl}>Mínimo por óptica (alerta)<input type="number" min={0} value={f.min} onChange={e => set('min', e.target.value)} className={inp} /></label>
                {item && <p className="col-span-2 text-[11px] text-zinc-400">Para cambiar existencias usa “Entrada” o “Traspasar”.</p>}
              </>}
            </>}

            {tipo === 'paquete' && <>
              <label className={lbl + ' col-span-2'}>Mica que incluye
                <select value={f.pMica} onChange={e => set('pMica', e.target.value)} className={inp}>
                  <option value="">Elige de tus micas…</option>
                  {micas.map(m => <option key={m.sku} value={m.sku}>{m.vision} {nomMica(m)} · {$(n(m.precio))}</option>)}
                </select></label>
              <div className="col-span-2"><div className={lbl + ' mb-1.5'}>Tratamientos que incluye</div>
                <div className="flex flex-wrap gap-2">{trats.map(t => (
                  <label key={t.sku} className="flex items-center gap-1.5 text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5">
                    <input type="checkbox" checked={f.pTrat.includes(t.sku)} onChange={e => set('pTrat', e.target.checked ? [...f.pTrat, t.sku] : f.pTrat.filter(s => s !== t.sku))} /> {t.nombre} · {$(n(t.precio))}
                  </label>))}</div></div>
              <label className="col-span-2 flex items-center gap-2 text-sm border border-zinc-200 rounded-lg px-3 py-2.5"><input type="checkbox" checked={f.pArm} onChange={e => set('pArm', e.target.checked)} /> Incluye armazón</label>
              {pm && Number(f.precio) > 0 && <p className="col-span-2 text-xs">Por separado {$(sep)} · {sep > Number(f.precio) ? <span className="text-emerald-600 font-semibold">el cliente ahorra {$(sep - Number(f.precio))}</span> : <span className="text-red-500 font-semibold">cuesta más que por separado</span>}</p>}
            </>}

            {tipo === 'tratamiento' && <>
              <label className="col-span-2 flex items-center gap-2 text-sm border border-zinc-200 rounded-lg px-3 py-2.5"><input type="checkbox" checked={tieneColores} onChange={e => setTieneColores(e.target.checked)} /> Tiene opciones de color</label>
              {tieneColores && <div className="col-span-2 border border-zinc-200 rounded-xl p-3 space-y-3">
                <p className="text-[11px] text-zinc-500">Cada color: sobreprecio (0 si cuesta igual) y en qué micas existe.</p>
                {colores.map((c, i) => (
                  <div key={i} className="border-b border-zinc-100 pb-3 last:border-0">
                    <div className="grid grid-cols-[1fr_100px_32px] gap-2">
                      <input value={c.color} onChange={e => setColores(L => L.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} placeholder="Color" className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm" />
                      <input type="number" value={c.extra} onChange={e => setColores(L => L.map((x, j) => j === i ? { ...x, extra: +e.target.value || 0 } : x))} placeholder="+$" className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm" />
                      <button onClick={() => setColores(L => L.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <button onClick={() => setColores(L => L.map((x, j) => j === i ? { ...x, micas: x.micas.length === micas.length ? [] : micas.map(m => m.sku) } : x))} className="text-[11px] font-semibold text-teal-700 mr-1">{c.micas.length === micas.length ? 'Ninguna' : 'Todas'}</button>
                      {micas.map(m => (
                        <label key={m.sku} className="flex items-center gap-1 text-[11px] border border-zinc-200 rounded px-1.5 py-0.5">
                          <input type="checkbox" checked={c.micas.includes(m.sku)} onChange={e => setColores(L => L.map((x, j) => j === i ? { ...x, micas: e.target.checked ? [...x.micas, m.sku] : x.micas.filter(s => s !== m.sku) } : x))} />
                          {m.vision?.slice(0, 4)}. {nomMica(m)}
                        </label>))}
                    </div>
                  </div>
                ))}
                <button onClick={() => setColores(L => [...L, { color: '', extra: 0, micas: micas.map(m => m.sku) }])} className="text-xs font-semibold text-teal-700">+ Agregar color</button>
                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-[11px] text-zinc-500 mb-1.5">Sobreprecio distinto en ciertas micas (opcional). Ej.: en Poly Plus los colores cuestan +$900.</p>
                  {extraMica.map(([k, v], i) => (
                    <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-2 mb-1.5">
                      <select value={k} onChange={e => setExtraMica(L => L.map((x, j) => j === i ? [e.target.value, x[1]] : x))} className="border border-zinc-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                        <option value="">Mica…</option>{micas.map(m => <option key={m.sku} value={m.sku}>{m.vision} {nomMica(m)}</option>)}
                      </select>
                      <input type="number" value={v} onChange={e => setExtraMica(L => L.map((x, j) => j === i ? [x[0], e.target.value] : x))} placeholder="+$" className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm" />
                      <button onClick={() => setExtraMica(L => L.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>))}
                  <button onClick={() => setExtraMica(L => [...L, ['', '']])} className="text-xs font-semibold text-teal-700">+ Agregar excepción</button>
                </div>
              </div>}
            </>}
            {!item && <p className="col-span-2 text-[11px] text-zinc-400">El SKU se asigna solo.</p>}
          </>}
          {err && <p className="col-span-2 text-xs text-red-500">{err}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-200 rounded-lg text-sm font-semibold hover:bg-zinc-50">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-[#1A1D27] disabled:opacity-50">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

