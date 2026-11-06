// Ventas del sistema anterior (OptikSoft, hasta julio 2026), guardadas en `compras_anteriores`.
// Se suman a "Ventas / Facturado" de Reportes y Finanzas cuando el periodo las incluye.
// No son cobros: no entran a Ingresos, Caja ni Por cobrar.
import type { SupabaseClient } from '@supabase/supabase-js'

export type VentaAnterior = {
  id: string; folio: string; total: number; anticipo: number; saldo: number
  sucursal: string; metodo_pago: string; atendido_por: string; created_at: string
}

export async function ventasAnteriores(
  sb: SupabaseClient, inicio: string, fin: string, sucursal = 'Todas',
): Promise<VentaAnterior[]> {
  if (inicio > '2026-07-31') return []   // OptikSoft se usó hasta julio 2026
  const out: VentaAnterior[] = []
  for (let i = 0; i < 20; i++) {
    let q = sb.from('compras_anteriores')
      .select('id, folio, total, sucursal, metodo_pago, fecha')
      .gte('fecha', inicio).lte('fecha', fin)
      .order('id').range(i * 1000, i * 1000 + 999)
    if (sucursal !== 'Todas') q = q.eq('sucursal', sucursal)
    const { data, error } = await q
    if (error || !data) break
    for (const r of data) out.push({
      id: `os-${r.id}`, folio: `OS-${r.folio ?? ''}`, total: Number(r.total) || 0, anticipo: Number(r.total) || 0, saldo: 0,
      sucursal: r.sucursal ?? '', metodo_pago: r.metodo_pago ?? '', atendido_por: 'OptikSoft',
      created_at: `${r.fecha}T12:00:00-07:00`,   // mediodía en Tijuana: cae en su día
    })
    if (data.length < 1000) break
  }
  return out
}
