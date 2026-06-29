// Configuración de sucursales — nombre de marca y datos de contacto
export const SUCURSAL_CONFIG: Record<string, {
  nombreLinea1: string
  nombreLinea2: string  // '' si no tiene segunda línea
  telefono: string
  whatsapp: string      // número compartido de atención al cliente
  direccion: string
  horario: string
  web: string
}> = {
  'Baja Visión': {
    nombreLinea1: 'Óptica Baja Visión',
    nombreLinea2: '',
    telefono: '661 104 0431',
    whatsapp: '664 834 3018',
    direccion: 'Blvd. Benito Juárez, Playas de Rosarito, B.C.',
    horario: 'Lun–Dom 10:00–18:00',
    web: 'gonmx.com',
  },
  '5 de Mayo': {
    nombreLinea1: 'Óptica Rosarito',
    nombreLinea2: 'Suc. 5 de Mayo',
    telefono: '661 612 0316',
    whatsapp: '664 834 3018',
    direccion: 'Av. 5 de Mayo, a un costado de Funeraria San Gabriel, Playas de Rosarito, B.C.',
    horario: 'Lun–Sáb 10:00–18:00',
    web: 'gonmx.com',
  },
  'Plaza Laureles': {
    nombreLinea1: 'Óptica Rosarito',
    nombreLinea2: 'Suc. Plaza Laureles',
    telefono: '661 104 0431',
    whatsapp: '664 834 3018',
    direccion: 'Plaza Laureles, Playas de Rosarito, B.C.',
    horario: 'Lun–Dom 10:00–18:00',
    web: 'gonmx.com',
  },
}

export function getNombreSucursal(sucursal: string): string {
  const cfg = SUCURSAL_CONFIG[sucursal]
  if (!cfg) return sucursal
  return cfg.nombreLinea2 ? `${cfg.nombreLinea1} ${cfg.nombreLinea2}` : cfg.nombreLinea1
}
