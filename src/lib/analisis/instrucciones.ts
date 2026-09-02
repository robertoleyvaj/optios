// ─────────────────────────────────────────────────────────────────────────────
// Paquete de análisis mensual · Genera INSTRUCCIONES_PARA_IA.md
// ─────────────────────────────────────────────────────────────────────────────
import type { MesData } from './queries'
import type { Metrics } from './metrics'

export function buildInstrucciones(d: MesData, m: Metrics): string {
  const cal = m.calidad
  const faltantes: string[] = []
  if (cal.ventasSinAtendio) faltantes.push(`- ${cal.ventasSinAtendio} ventas sin "atendió" → productividad por empleada incompleta.`)
  if (cal.gastosSinCategoria) faltantes.push(`- ${cal.gastosSinCategoria} gastos sin categoría o con categoría desconocida.`)
  if (cal.ordenesSinCosto) faltantes.push(`- ${cal.ordenesSinCosto} órdenes de laboratorio sin costo capturado → margen de esas piezas no calculable.`)
  if (cal.garantiasSinMotivo) faltantes.push(`- ${cal.garantiasSinMotivo} garantías sin motivo registrado.`)
  if (cal.diasSinCorte) faltantes.push(`- ${cal.diasSinCorte} días-sucursal sin corte de caja → cuadre de esos días incompleto.`)
  if (cal.pagosHuerfanos) faltantes.push(`- ${cal.pagosHuerfanos} pagos sin venta ligada.`)
  if (cal.fuentesConError.length) faltantes.push(`- Fuentes que fallaron al leer: ${cal.fuentesConError.join('; ')}.`)
  if (!faltantes.length) faltantes.push('- Sin faltantes graves detectados este mes.')

  return `# INSTRUCCIONES PARA IA — Análisis mensual OptiOS

## Periodo analizado
**${d.mesLabel}**  ·  ${d.fechaIni} → ${d.fechaFin}  ·  Zona horaria: America/Tijuana
Sucursales: Baja Visión, 5 de Mayo, Plaza Laureles.

Este archivo acompaña al Excel \`Analisis_${d.anio}-${String(d.mes0 + 1).padStart(2, '0')}.xlsx\`.
Es la operación real de una cadena de 3 ópticas. Cada hoja trae un resumen y su detalle para que puedas auditar cualquier número.

## Qué significa cada hoja
1. **Resumen** — cifras clave del mes (facturado, cobrado, utilidad, márgenes).
2. **Por sucursal** — cada óptica como negocio propio, con overhead repartido de dos formas (÷3 y proporcional al cobrado).
3. **Ventas** — una fila por venta (folio, total, descuento, anticipo, saldo, piezas, estado).
4. **Líneas de venta** — una fila por producto vendido dentro de cada venta.
5. **Pagos** — cada pago recibido en el mes; \`De venta del mes\` = "no (previa)" son cobros de ventas de meses anteriores.
6. **Egresos** — cada gasto; \`Es caja=sí\` son gastos que salieron del cajón (no cuentan como gasto de empresa en el P&L).
7. **Productividad** — ventas, piezas, ticket, descuento otorgado y horas por empleada.
8. **Conversión** — exámenes, citas, no-shows y cuántos terminaron en venta.
9. **Lentes y tratamientos** — piezas, ingreso, costo y margen por tipo de mica y por tratamiento.
10. **Laboratorios** — costo, margen, días de entrega, % de retraso, urgentes y garantías por laboratorio.
11. **Garantías** — cada reposición: motivo, laboratorio, costo, folio de origen.
12. **Nómina y comisiones** — pagado por categoría (empresa vs caja).
13. **Caja y métodos** — diferencias y retiros por sucursal; cobrado por método de pago.
14. **Inventario** — valor a costo y armazones ordenados por margen.
15. **Tendencias** — facturado y cobrado por día y por hora.
16. **Calidad** — huecos e inconsistencias de datos del mes.

## Fórmulas usadas
- **Facturado** = Σ total de ventas del mes (excluye canceladas y cotizaciones).
- **Cobrado** = Σ pagos recibidos en el mes (por fecha de pago) + pagos de pacientes de ventas previas al sistema registrados en caja (categoría \`pago_previo\`). **Es base caja, no base devengado**: puede ser mayor o menor que el facturado.
- **Cobrado de meses previos** = pagos del mes cuya venta se creó en un mes anterior.
- **Costo de laboratorio** = Σ \`costo_lab\` de órdenes pagadas al laboratorio en el mes (excluye garantías).
- **Garantías** = Σ \`costo_lab\` de órdenes marcadas \`es_garantia\` pagadas en el mes.
- **Utilidad bruta** = Cobrado − Costo lab − Garantías.
- **Gastos operativos** = gastos de empresa (los de caja NO cuentan) excepto retiros del dueño.
- **Utilidad neta** = Utilidad bruta − Gastos operativos.
- **Flujo neto** = Utilidad neta − Retiros del dueño.
- **Overhead** = gastos operativos no asignados a una sucursal específica; repartido ÷3 o proporcional al cobrado.
- **Margen por lente/tratamiento/lab** = precio al cliente − costo de laboratorio.
- **Conversión** = pacientes con examen/cita que además tienen una venta en el mes (cruce por teléfono).

## Estados que verás
- Ventas: \`activa\`, \`cancelada\`, \`cotización\`.
- Pagos: \`abono\` (parcial) / \`liquidacion\` (saldo final).
- Órdenes de lab: \`recibido\`, \`en_proceso\`, \`entregado\`, etc.
- Gastos: \`Es caja\` sí/no separa el cajón del gasto de empresa.

## KPIs que NO son 100% confiables todavía (trátalos como aproximados)
- **Conversión examen/cita → venta**: se cruza por teléfono porque las ventas aún no guardan \`paciente_id\`. Puede subestimar.
- **Productividad por empleada**: la venta guarda el nombre en texto (\`atendido_por\`), no un id; nombres mal escritos se separan.
- **Comisiones y bonos**: solo se ve lo **pagado** (desde gastos), no lo devengado por venta.
- **Margen de consumibles**: usa el costo actual del catálogo, no el costo congelado al momento de la venta.
- **Tipo de mica / tratamiento**: son texto libre; agrupaciones parecidas pueden ser el mismo concepto escrito distinto.

## Qué falta o quedó incompleto este mes
${faltantes.join('\n')}

## Prompt sugerido para pedir el análisis
Copia esto y adjunta el Excel:

> Eres analista financiero y de operaciones de una cadena de 3 ópticas en México (Baja Visión, 5 de Mayo, Plaza Laureles). Te adjunto el Excel de **${d.mesLabel}** con hojas de resumen y detalle. Analiza a profundidad y entrégame:
> 1. Diagnóstico financiero del mes: cuánto se facturó, cuánto se cobró, cuánto se ganó realmente y el flujo de efectivo. Explica la diferencia entre facturado y cobrado.
> 2. Rentabilidad real por sucursal (usa las dos formas de overhead) y por qué la menos rentable pierde o gana.
> 3. Punto de equilibrio aproximado por sucursal.
> 4. Mejores y peores días y horarios; recomendaciones de horario/personal.
> 5. Productividad y rentabilidad por empleada; quién destaca y quién necesita apoyo.
> 6. Conversión de exámenes y citas a venta; oportunidades perdidas.
> 7. Rentabilidad por tipo de lente y por tratamiento; qué empujar y qué revisar de precio.
> 8. Comparación de laboratorios: costo, tiempos de entrega, retrasos y garantías; a quién darle más o menos trabajo.
> 9. Garantías: causas y costo; qué está generando re-trabajo.
> 10. Fugas de dinero: gastos atípicos, duplicados o sin clasificar, descuadres de caja y diferencias.
> 11. Productos y armazones más y menos rentables.
> 12. Con base en la hoja "Calidad", qué datos deberíamos empezar a registrar mejor para que el próximo análisis sea más confiable.
> Sé concreto, con cifras del archivo, y termina con las 5 acciones de mayor impacto para el próximo mes.

*Recuerda: los KPIs marcados como aproximados no deben presentarse como exactos.*
`
}
