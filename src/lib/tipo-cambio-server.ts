// Tipo de cambio USD→MXN que el admin captura en Ajustes → Pagos (solo servidor).
import { createAdminClient } from '@/lib/supabase/admin'

export async function tipoCambioServidor(): Promise<number | null> {
  try {
    const { data } = await createAdminClient().from('configuracion').select('valor').eq('clave', 'tipo_cambio_usd').maybeSingle()
    const v = parseFloat(String(data?.valor ?? ''))
    return v > 0 ? v : null
  } catch { return null }
}
