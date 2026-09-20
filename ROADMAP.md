# Hoja de ruta

Una app de control de gastos para uso **personal** y como **servicio a iglesias**,
instalable en el móvil (PWA) y con versión `.apk`.

Cada fase se entrega en su propia rama, con pruebas, y solo pasa a `main` (que
despliega Netlify y Render) cuando está verificada.

## Arreglos pendientes

- [x] **El saldo contaba movimientos con fecha futura.** Al marcar "Se repite",
      la app crea de una vez todas las repeticiones con sus fechas futuras, y
      el "Saldo en caja" las sumaba: quien registraba el alquiler de todo el
      año se veía el saldo descontado de golpe. También afectaba a los fondos
      y a las constancias (una emitida en junio podía incluir diezmos de
      diciembre). Regla nueva: **los saldos y totales cuentan hasta hoy**, y lo
      que tiene fecha posterior aparece marcado como "Programado".

## Fase 1 — Base: espacios, roles y confianza

- [x] **Espacios de trabajo**: cada usuario tiene un espacio personal y puede
      crear o unirse a espacios de iglesia. Todo (movimientos, categorías) vive
      dentro de un espacio, no de un usuario.
- [x] **Roles por espacio**: propietario, tesorero, contador, auditor (solo
      lectura) y lector.
- [x] **Invitaciones** por enlace (se puede mandar por WhatsApp) y por correo.
- [x] **Montos en centavos** (enteros) y **moneda por espacio**. La API sigue
      hablando en unidades (`150.50`); la conversión vive en un solo sitio.
- [x] **Anular en vez de borrar**: un movimiento anulado se sigue viendo,
      tachado y con su motivo, y deja de sumar. Borrar del todo queda solo para
      el propietario.
- [x] **Historial de auditoría**: quién creó, editó o anuló qué y cuándo.
- [x] **Recuperación de contraseña** por correo.
- [x] **Migración** de los datos existentes: cada usuario actual pasa a ser
      propietario de un espacio de iglesia con sus movimientos
      (`scripts/migrar-espacios.js`, probado con datos de la forma actual).
- [x] **Desplegar**: fusionado en `main` y migración aplicada en producción (2026-09-18).

## Fase 2 — App instalable (PWA) y APK

- [x] Manifest, íconos y pantalla de inicio (`vite-plugin-pwa`).
- [x] Service worker: la app abre sin conexión.
- [x] Registrar movimientos sin conexión y sincronizar al volver, sin duplicados.
- [x] Foto del comprobante con la cámara del móvil (Cloudinary privado, enlaces de 5 min).
- [x] APK como Trusted Web Activity (Bubblewrap) con
      `/.well-known/assetlinks.json` en Netlify (verificado por Google y
      probado en un emulador Android 17). Ver `android/README.md`.
- [ ] Notificaciones push (recordatorios, resumen semanal). Pasan a la fase 4.

## Rediseño visual (entre las fases 2 y 3)

- [x] Paleta nueva (fondo greige, tarjetas blancas, ámbar para registrar) con
      modo claro, oscuro y según el sistema; fuente Manrope.
- [x] Móvil: barra inferior con "+" central, Inicio simplificado, registrar con
      teclado propio, movimientos con búsqueda y filtros.
- [x] Computadora: barra lateral, Inicio con cifras, barras por mes, dona y
      tabla; Movimientos en tabla.
- [x] Portada, acceso, íconos de la app y el resto de pantallas.
- [x] **Desplegar**: fusionado en `main` (2026-09-19).
- [x] APK 1.1.0 (versionCode 2) con los colores y el ícono nuevos; se instala encima de la 1.0.0.

## Fase 3 — Núcleo de iglesia

- [x] Tipos de ingreso de iglesia: diezmo, ofrenda, primicia, ofrenda especial
      (cada categoría de ingreso tiene su tipo; ingresos por tipo en el Inicio y
      en el Excel).
- [x] Aportantes con privacidad: quién dio cuánto solo lo ven propietario,
      tesorero y contador (la API lo oculta al auditor y a los lectores).
- [x] Constancias de donación anuales en PDF (por persona o todas de un año;
      total en cifras y en letras, por tipo de aporte y por mes).
- [ ] Conteo de ofrenda del culto con doble firma.
- [x] Contabilidad por fondos (general, misiones, construcción, benevolencia):
      saldo por fondo, pases entre fondos (anulables) y fondos archivados.
- [ ] Presupuesto anual por ministerio, con alertas al 80 % y 100 %.
- [ ] Rol de líder de ministerio (solo ve y solicita sobre su presupuesto).
- [x] Campañas con meta y barra de avance (un fondo con meta).
- [ ] Informes mensual y anual en PDF con el logo de la iglesia.
- [ ] Enlace de solo lectura para compartir un informe con la congregación.

## Fase 4 — Núcleo personal

- [ ] Cuentas y tarjetas con saldo real (y fecha de corte).
- [ ] Transferencias entre cuentas.
- [ ] Presupuestos mensuales por categoría y metas de ahorro.
- [ ] Recurrentes que avisan cuando toca y se confirman con el importe real.
- [ ] Deudas y préstamos.
- [ ] Importar el extracto del banco (CSV/Excel).
- [ ] Etiquetas, búsqueda y filtros guardados.

## Fase 5 — Servicio para iglesias

- [ ] Donaciones en línea con PayPal (se reutiliza el sistema probado de
      `holy_app`: órdenes, suscripciones, webhooks, reembolsos y comisiones).
- [ ] Planes de suscripción para iglesias (PayPal Subscriptions).
- [ ] Flujo de aprobación de gastos (solicitar, aprobar, pagar).
- [ ] Conciliación bancaria y cierre mensual (bloquea editar meses cerrados).
- [ ] Varias sedes con informe consolidado.
- [ ] Landing page, alta guiada y datos de ejemplo.
- [ ] Soporte: centro de ayuda (cómo registrar, roles, fondos, constancias) y
      un botón de "reportar problema" desde la app.
- [ ] Verificación de correo y 2FA para tesoreros.
- [ ] Exportación completa de datos, términos y privacidad.
- [ ] Infraestructura: plan de pago en Render (sin arranque en frío) y copias
      de seguridad de Atlas.
