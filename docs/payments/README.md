# Pagos, suscripciones y compras — Trio Misión

> **Estado:** estrategia acordada e implementada en la API para el flujo
> inicial (QR/transferencia con revisión manual), Premium por períodos,
> cupones, códigos de canje y permisos adicionales por pista (Sprints 3A,
> 3C.1 y 3C.2). Proveedores externos (Binance, IAP, QR dinámico) siguen sin
> integración.

## 1. Principios

La API es la fuente de verdad y distingue:

- **Orden:** intención de compra con importe y moneda congelados.
- **Intento de pago:** operación con un método/proveedor y su estado verificado.
- **Suscripción:** periodo temporal de Premium.
- **Entitlement:** acceso a audio u otro producto.
- **Licencia:** usos permitidos sobre una pista y términos aceptados.
- **Cupón:** descuento calculado por el backend (nunca por el cliente) sobre
  el subtotal de una orden.
- **Canje:** concesión de suscripción o entitlements con `grant_source=
  redemption`, mediante código, sin pago.

Premium no incluye automáticamente audio descargable ni permisos de uso. Los pagos
pueden fallar, revisarse, reembolsarse o revertirse sin borrar el historial. Una
aprobación o notificación repetida no debe duplicar acceso, suscripción ni pago.

## 2. Flujo inicial: QR/transferencia manual

1. El usuario autenticado selecciona una oferta y crea una orden.
2. El backend crea un intento con referencia e importe exactos y muestra las
   instrucciones o QR estático configurado.
3. El usuario adjunta el comprobante en almacenamiento privado.
4. Staff autorizado revisa referencia, importe, fecha y evidencia; aprueba o rechaza
   con comentario y auditoría.
5. Al aprobar, el backend confirma el pago y concede, en la
   misma transacción lógica y de forma idempotente, el período Premium, los
   entitlements de las pistas congeladas en el snapshot de la orden y los
   grants de licencia (`license_grants`).
   Para paquetes con `include_future_tracks=false` solo se entregan las
   pistas del snapshot; con `true`, el contenido publicado vigente al aprobar.
   Cada licencia solicitada genera un `license_grant` con usos y condiciones
   congeladas, protegido contra duplicación con `license_grants_order_item_uidx`.
6. El cliente consulta el estado. Ninguna pantalla activa acceso por recibir una
   imagen o por escanear el QR.

Las órdenes tienen expiración configurable. Un reenvío crea otro intento registrado.
Los comprobantes solo son visibles para su titular y staff autorizado.

### Cupones y códigos de canje

- El cliente solo envía el código del cupón en la creación de la orden; el
  backend valida vigencia, límites total/por usuario, moneda y monto mínimo,
  calcula subtotal, descuento y total, y jamás persiste un total cero o
  negativo (check en base: `total = subtotal - descuento`, `total > 0`).
- Un cupón que dejaría el total en cero se rechaza con 422 al crear la orden.
- Los códigos de canje conceden suscripción o entitlements con
  `grant_source=redemption`, sin crear pago, respetando vigencia y límites.
  El mismo usuario no canjea dos veces el mismo código (ni consume dos usos);
  la clave de cliente del canje tampoco se reutiliza con otro código.

## 3. Proveedores futuros

Los adaptadores comparten operaciones conceptuales de crear intento, consultar
estado, validar notificación/recibo y registrar reversión, sin fingir que todos
tienen el mismo ciclo de vida.

- **Binance:** confirmar identificador, importe y estado desde backend; una captura
  enviada por el cliente no constituye prueba suficiente.
- **Google Play Billing / Apple IAP:** validar recibos/tokens protegidos en servidor
  y procesar renovaciones, cancelaciones, vencimientos y reembolsos.
- **QR dinámico:** referencia única por orden e importe, webhook firmado o consulta
  autenticada, expiración y conciliación.

Antes de vender contenido digital dentro de una app o enlazar al checkout web se
revisarán las reglas vigentes de la plataforma y el canal de distribución.

## 4. Datos e idempotencia

- Importes en unidades menores enteras y moneda ISO; nunca `float`.
- Claves idempotentes únicas y restricciones sobre referencias del proveedor cuando
  existan.
- Conservar estado e identificador externos, con payload minimizado y protegido.
- Verificar webhooks antes de aplicar efectos y tolerar reintentos.
- No guardar secretos, tokens completos ni comprobantes en logs.
- Reembolsos, revocaciones y cambios manuales conservan actor, fecha y motivo.
  La revocación staff de una licencia (`revoked_at` no nulo) corta su vigencia
  sin afectar el entitlement de descarga de audio, y viceversa.
- Las órdenes congelan oferta, producto, contenido, totales (subtotal,
  descuento, total) y opciones de licencias en sus ítems; la aprobación toma
  de esos snapshots el plan y su duración, la bandera de contenido futuro y los
  términos/usos de licencias vigentes al crear la orden, no sus valores actuales.
  La idempotencia de creación valida que oferta, cupón, licencias y payload
  coincidan con el reintento.
- Repetir aprobación o canje nunca duplica suscripciones, pagos, accesos ni
  licencias: índices únicos parciales por `order_item_id`/`redemption_id` y por
  (usuario, pista/asset) vigente.

## 5. Soporte

El comprador puede abrir casos de pago, descarga/archivo, permiso/YouTube o consulta
general vinculados a su orden. Para reclamos se registran URL/claim ID y licencia;
no se promete liberación ni monetización, especialmente cuando intervienen otros
titulares.

## 6. Roadmap

| Etapa | Funcionalidad | Estado |
|---|---|---|
| 1 | Premium y audio mediante QR/transferencia con revisión manual | Implementado (Sprints 3A y 3C.1) |
| 1b | Cupones y códigos de canje con vigencia, límites e idempotencia | Implementado (Sprint 3C.1) |
| 1c | Licencias y permisos adicionales por pista como complementos de audio | Implementado (Sprint 3C.2) |
| 2 | Binance verificado desde backend | Pendiente |
| 3 | Google Play Billing y Apple IAP según canal y políticas | Pendiente |
| 4 | QR dinámico con confirmación automática y conciliación | Pendiente |
