'use client'
// Registrar un gasto extra (estuches, sprays, lente extra…). Se va solo a Finanzas → Egresos.
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import { CATEGORIAS_RUTA, type Encargo } from '@/lib/ruta'

function Registrar() {
  const router = useRouter()
  const params = useSearchParams()
  const encargoParam = Number(params.get('encargo')) || null

  const [encargos, setEncargos] = useState<Encargo[]>([])
  const [encargoId, setEncargoId] = useState<number | null>(encargoParam)
  const [categoria, setCategoria] = useState<string>('')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<'efectivo' | 'transferencia'>('efectivo')
  const [folio, setFolio] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    fetch('/api/ruta').then(r => r.json()).then(j => {
      if (!j.ok) return
      const pend = (j.encargos ?? []).filter((e: Encargo) => e.estado === 'pendiente') as Encargo[]
      setEncargos(pend)
      const e = pend.find(x => x.id === encargoParam)
      if (e) setDescripcion(d => d || e.descripcion)
    }).catch(() => {})
  }, [encargoParam])

  const guardar = async () => {
    setError('')
    if (!categoria) return setError('Escoge qué fue')
    if (!descripcion.trim()) return setError('Escribe qué compraste')
    if (!(Number(monto) > 0)) return setError('Escribe cuánto costó')
    setGuardando(true)
    try {
      const r = await fetch('/api/ruta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'gasto', categoria, descripcion: descripcion.trim(), monto: Number(monto), metodo, folio, encargo_id: encargoId }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar')
      setListo(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally { setGuardando(false) }
  }

  if (listo) return (
    <div className="max-w-md mx-auto pt-16 text-center">
      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
      <p className="text-lg font-semibold text-zinc-900 mt-3">Gasto registrado</p>
      <p className="text-sm text-zinc-500 mt-1">${Number(monto).toLocaleString('es-MX')} · {descripcion}</p>
      <div className="mt-8 space-y-2">
        <button onClick={() => router.push('/dashboard/ruta')} className="w-full h-12 rounded-xl bg-[#0B0E14] text-white text-sm font-semibold">Ir al inicio</button>
        <button onClick={() => { setListo(false); setCategoria(''); setDescripcion(''); setMonto(''); setFolio(''); setEncargoId(null) }}
          className="w-full h-12 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700">Registrar otro</button>
      </div>
    </div>
  )

  const pill = (on: boolean) => `px-3.5 h-10 rounded-full text-sm border transition-colors ${on ? 'bg-[#0B0E14] text-white border-[#0B0E14]' : 'bg-white text-zinc-600 border-zinc-200'}`
  const lbl = 'block text-sm text-zinc-500 mb-1.5 mt-5'
  const campo = 'w-full h-12 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30'

  return (
    <div className="max-w-md mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-0.5 -ml-1.5 h-9 pr-2 text-[15px] text-[#0D9488] font-semibold"><ChevronLeft className="w-5 h-5" /> Atrás</button>
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mt-1">Registrar gasto</h1>
      <p className="text-sm text-zinc-400 mt-0.5">Algo que pagaste aparte del laboratorio</p>

      <label className={lbl}>¿Qué fue?</label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS_RUTA.map(c => (
          <button key={c.key} type="button" onClick={() => setCategoria(c.key)} className={pill(categoria === c.key)}>{c.label}</button>
        ))}
      </div>

      {encargos.length > 0 && (
        <>
          <label className={lbl}>¿Es de un encargo?</label>
          <select value={encargoId ?? ''} onChange={e => {
            const id = Number(e.target.value) || null
            setEncargoId(id)
            const en = encargos.find(x => x.id === id)
            if (en && !descripcion) setDescripcion(en.descripcion)
          }} className={campo}>
            <option value="">No</option>
            {encargos.map(e => <option key={e.id} value={e.id}>{e.descripcion}{e.sucursal !== 'General' ? ` · ${e.sucursal}` : ''}</option>)}
          </select>
        </>
      )}

      <label className={lbl}>¿Qué compraste?</label>
      <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="20 estuches negros" className={campo} />

      {categoria === 'lente_extra' && (
        <>
          <label className={lbl}>¿De qué trabajo? <span className="text-zinc-300">(opcional)</span></label>
          <input value={folio} onChange={e => setFolio(e.target.value)} placeholder="L-0412" className={`${campo} uppercase`} />
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>¿Cuánto costó?</label>
          <input value={monto} onChange={e => setMonto(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="$0" className={campo} />
        </div>
        <div>
          <label className={lbl}>Pagado con</label>
          <div className="grid grid-cols-2 h-12 rounded-xl border border-zinc-200 bg-white overflow-hidden text-sm">
            {(['efectivo', 'transferencia'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMetodo(m)}
                className={metodo === m ? 'bg-[#0B0E14] text-white font-medium' : 'text-zinc-600'}>{m === 'efectivo' ? 'Efectivo' : 'Transf.'}</button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      <button onClick={guardar} disabled={guardando}
        className="mt-6 w-full h-12 rounded-xl bg-[#0B0E14] text-white text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-60">
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      <p className="text-xs text-zinc-400 text-center mt-3">Se registra solo en Finanzas como egreso</p>
    </div>
  )
}

export default function RegistrarPage() {
  return <Suspense fallback={null}><Registrar /></Suspense>
}
