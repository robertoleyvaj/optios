# OptiOS — Historial de versiones

Formato mayor.menor.corrección. El código junto a la versión (ej. `· a19bc32`) es el deploy de Vercel.

## v2.3.1 (29 oct 2026)
- Tienda en línea · GON: etiqueta naranja **"Falta examen"** cuando el cliente pagó sin graduación (no mandarlo a hacer hasta tener su examen).

## v2.3 (29 oct 2026)
- **Tienda en línea · GON**: pedidos pagados en gonmx.com con Apartar / Anticipo / Liquidar. Se ve cuánto pagó, cuánto debe, en qué sucursal recoge y hasta cuándo vale el apartado (en rojo si venció, con su saldo a favor). Estados de GON: apartado, pendiente, en proceso, listo, entregado; "listo" le manda correo al cliente para que pase a recoger.

## v2.2 (28 oct 2026)
- **Código web (WEB-XXXXX)**: el cliente que aparta en gonmx.com recibe un código. En Nueva venta se escribe en el recuadro "Código web" y se aplica solo el precio web: armazones publicados en GON −60% y micas/filtros de la página −15% (Varilux, Kodak, Transitions, Crizal, Younger, LC, consumibles y servicios quedan a precio normal). Sirve para toda la compra, una vez, 30 días. No se junta con el cupón de ticket.
- gonmx.com toma los precios de micas y filtros de OptiOS (−15%) automáticamente.

## v2.1.6 (27 oct 2026)
- Las micas nuevas o editadas se guardan en MAYÚSCULAS, igual que el resto del catálogo.

## v2.1.5 (27 oct 2026)
- **Micas Younger**: nueva visión "Younger" junto a Monofocal, Bifocal y Progresivo (SKU YNG-…). Se agrega desde Inventario → Productos → Micas y se comporta igual que las demás micas (orden de laboratorio, tratamientos, paquetes).

## v2.1.4 (22 oct 2026)
- **Paquetes por sucursal**: al editar un paquete eliges en qué ópticas es válido (Baja Visión, 5 de Mayo, Plaza Laureles). En la lista se ve en verde dónde aplica y tachado dónde no.

## v2.1.3 (22 oct 2026)
- **Ventas en celular**: Nueva venta ya no se desborda (datos del cliente en 2 columnas, productos como tarjetas con cantidad, descuento y quitar; botones de Cotización/Venta a lo ancho). En el historial, el detalle de la venta sale como panel desde abajo con más espacio para los productos y botones compactos.

## v2.1.2 (22 oct 2026)
- **Reportes · Otros saldos**: al darle clic se abre la lista de ventas con saldo que no están en laboratorio ni listas (cliente, folio, sucursal, fecha, artículos, saldo) con botón **Cobrar** que abre el abono. Marca en rojo las que ya se entregaron.

## v2.1.1 (6 oct 2026)
- **Regla automática: un color se ve en la web solo si tiene fotos.** Al subirle foto a un color de un modelo publicado se hace visible solo; al publicar el modelo se muestran los colores con fotos; si le borras la última foto, se oculta solo.

## v2.1 (6 oct 2026)
- **5 fotos por color**: 4 del armazón (frente, tres cuartos, lado, detalle) + 1 **foto de ambiente** opcional. En Verly la de ambiente sale en la tarjeta del catálogo y al pasar el mouse se ve la del armazón.
- Al **publicar** un modelo, los colores que ya tienen fotos se hacen visibles solos (antes había que quitar "Oculto" color por color).

## v2.0.2 (6 oct 2026)
- Al guardar una entrada, cada armazón trae el botón **Abrir ficha** para subir fotos y datos de la web de una vez.

## v2.0.1 (6 oct 2026)
- **Fotos por color más rápidas**: se pueden escoger las 3 fotos de una vez y se suben al mismo tiempo; ya no se pierde una foto si se toca otra casilla mientras la anterior sigue subiendo.
- Alta de modelo nuevo sin apodo ya no marca error (el apodo queda igual al modelo).

## v2.0 (2 oct 2026)
- **Inventario nuevo activo**: el punto de venta busca y descuenta por SKU de color (VRL-1xxx-xx). Un solo inventario para ópticas, bodega y web. El inventario viejo queda solo como consulta.

## v1.13 (2 oct 2026)
- **Ajustar existencias** desde la ficha (admin y gerente): por color y ubicación, "dice el sistema / hay de verdad", con motivo (error de captura, conteo físico, dañado o perdido). Queda en la bitácora.
- **Corregir errores de dedo** (admin): marca, modelo y nombre de color.

## v1.12.1 (1 oct 2026)
- Inventario cómodo desde el celular: lista en tarjetas, ficha con tablas deslizables y campos apilados, botones de foto visibles sin mouse, teclado numérico en medidas y piezas.
- Las fotos se reducen antes de subir (de 3–5 MB a ~300 KB) para que la web cargue rápido.
- Rol "Web" (antes "Encargado web"); no ve el inventario viejo.

## v1.12 (1 oct 2026)
- **Entrada de armazones nueva**: entra a Bodega por defecto, un solo buscador, marca de lista, medidas en 3 cajitas, varios colores de una vez, aviso de modelos repetidos o parecidos, sin costo.
- **Gamas de precio** por marca (Básico / Estándar / Premium): el precio se pone solo dentro del rango, nunca cerrado. **Precio Verly automático** = pesos ÷ tipo de cambio × 50%.
- **Cola de etiquetas**: cada entrada agrega sus etiquetas; se imprimen todas juntas en tabloide y se marcan como impresas. Reimpresión por color desde la ficha.
- **Ficha reordenada**: primero colores y existencias, datos y precio, movimientos; abajo el bloque **Para la web** (fotos por color con ⭐ portada, datos web y publicar). Se quitó la sección de fotos generales.
- **Pendientes de web en rojo**: modelos con 3+ piezas sin fotos o sin publicar.
- **Rol "Encargado web"**: solo inventario (entradas, etiquetas, fotos, datos web, publicar). Sin ventas, costos ni traspasos.

## v1.11 (1 oct 2026)
- **Datos para la web** en la ficha del armazón (solo admin): nombre en la web (apodo), para quién, forma, tipo de armazón, etiqueta y descripción en español e inglés. La talla se calcula sola de las medidas. Base para que Verly y GON tomen todo de OptiOS.

## v1.10 (1 oct 2026)
- **Colores en la web**: en la ficha del armazón (inventario nuevo) cada color tiene su circulito, hasta 3 fotos y un botón para mostrarlo u ocultarlo en la web.
- Pedidos de la tienda en línea: muestran el color del armazón que eligió el cliente (con su SKU) y el color de los filtros.

## v1.9.2 (30 sep 2026)
- Cupones del ticket: se generan, validan y canjean desde el servidor (antes no se guardaban).

## v1.9.1 (30 sep 2026)
- Catálogo: corrección de marca vacía al guardar productos.

## v1.9 (30 sep 2026)
- **Catálogo de productos por pestañas**: Micas y tratamientos (micas, tratamientos con colores por mica, paquetes), Lentes de contacto (en stock / sobre pedido), Consumibles (con o sin control de stock) y Servicios. Costos solo para administrador.
- Logo e isotipo de OptiOS en menú y login; favicon e íconos nuevos.

## v1.8 (28–29 sep 2026)
- **Inventario nuevo (vista previa)**: SKU por color, ficha de armazón con fotos y publicación, entradas de mercancía, bodega, bitácora de movimientos, traspasos con confirmación y aviso en campanita, POS por color en modo prueba.
- **Seguridad**: todas las rutas del servidor revisan sesión y rol; el costo solo llega al administrador.

## v1.7 (25 sep 2026)
- Botón de **garantía** en expedientes (cambio de producto o de graduación, 60 días).
- **Cupón de descuento** en el ticket según tabulador y canje en ventas.
- Búsqueda de pacientes por todas las palabras en todos los buscadores; sucursales legacy normalizadas.

## v1.6 (sep 2026)
- Laboratorio: nota 4×6, reimprimir entregadas, vista del repartidor, filtro de sucursal.
- Sucursal del día en el encabezado para todos los roles (registra el check-in).
- Cupones de la tienda en línea (fase 1).

## v1.5 (sep 2026)
- **Análisis mensual** de finanzas (Excel de 16 hojas) y pantalla de pendientes del cierre.
- Finanzas con cobrado real, garantías como línea propia y comisiones por método.
- Borrar venta (admin) devolviendo stock; editar método de pago.

## v1.4 (agosto 2026)
- Inventario de armazones por **color/variante**: un SKU por modelo, colores con stock por sucursal, publicación y fotos por color.
- **Bodega central**: piezas guardadas sin exhibir, separadas de lo exhibido por sucursal.
- Fusión de SKU duplicados y reconciliación del catálogo web.
- **Hoja de paciente** rediseñada: logo GON, tipografía Poppins, datos reales de sucursal, ilustración dinámica y diagnóstico refractivo profesional por ojo con recomendación de lente.
- Etiquetas de armazones (PDF tabloide con logo, SKU, precio y color).
- Estabilidad de sesión: middleware con `getSession` + login con timeout (fin del "Verificando" congelado).
- Check-in/out de asistencia solo desde computadora.

## v1.3 — Tienda en línea, finanzas
## v1.2 — RRHH, checador, vacaciones
## v1.1 — Ventas, expedientes, laboratorio, caja
## v1.0 — Primera versión de producción
