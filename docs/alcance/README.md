# Alcance del sistema — Trio Misión v2

> **Estado:** documento vivo de alcance y requerimientos. Consolida las funciones
> heredadas y las decisiones de producto acordadas para catálogo, himnario,
> tienda, audio, permisos, servicios y biblioteca personal.

## 1. Propósito y ecosistema

Trio Misión ayuda a jóvenes adventistas y músicos a aprender canciones y usarlas
en iglesias y recitales, incluso sin dominar teoría musical. La experiencia de
letras/acordes y el modo escenario/tablet son el centro del producto.

```
apps/web        Sitio público y portal web de cuenta/compras
apps/mobile     App móvil v2 (Flutter)
apps/pc         Cliente PC para usuarios, con la misma API y cuenta que APK (previsto)
apps/admin      Panel administrativo v2 para staff, managers y members
services/api    API central en Go y autoridad de negocio
services/worker Conversiones, procesamiento de audio y otras tareas asíncronas
```

Todos los clientes consumen la misma API. Ninguno accede directamente a PostgreSQL.

## 2. Funciones heredadas a preservar

### App móvil

- Himnario Adventista con acordes, sin cuenta obligatoria, sujeto a permisos de
  distribución.
- Catálogo artista → álbum → canción con ChordPro y tablatura PDF cuando exista.
- Transposición, capo, cifrado latino/americano y ajuste de presentación.
- Mi Música con canciones propias, carpetas e importación de PDF/`.cho`.
- Repertorios que combinan catálogo, himnario y canciones propias.
- Modo Escenario, afinador local y biblioteca de acordes.
- Offline-first, sync delta, descargas Premium cifradas y límite de dispositivos.
- Notificaciones in-app; push FCM entra en v2.
- Autoscroll en cliente: se conserva su desarrollo actual. La alineación futura
  entre letra y audio se definirá sin usar números de línea visuales.

### Panel administrativo

- CRUD y organización de estilos, artistas, álbumes, canciones, versiones de himnos
  y temáticas, con editor ChordPro e importación.
- Productos, ofertas, órdenes, pagos manuales, canjes, usuarios, dispositivos,
  reportes, configuración y auditoría.
- Roles globales `admin`, `editor` y `vendedor`. Por artista, `member` entra al
  panel pero solo lee canciones/contenido autorizado de sus artistas; `manager`
  administra únicamente sus artistas. Un usuario puede acumular roles y la API
  valida siempre el alcance, sin administración ni pagos para `member`.
- Revisión de permisos de uso, activos de audio, pagos, soporte y reclamos.

## 3. Contenido e himnario

- Artistas genéricos: Trío Misión, el coro polifónico y futuros grupos comparten el
  mismo modelo, con productos y permisos propios.
- Las transcripciones `.cho` preparadas manualmente son trabajo editorial; no se
  consideran autorización sobre la obra subyacente.
- La disponibilidad puede ser gratuita, Premium, compra o creador, siempre según
  autorización y política editorial.
- Spotify/YouTube se guardan como enlaces externos verificables. Un enlace no
  implica alojar audio, reproducirlo dentro de la app ni autorizar la letra.
- Cada himno conserva colección, número y título; sus versiones guardan el
  ChordPro. Las dos iniciales son `full_song` y `verse_chorus`.

## 4. Premium, tienda de audio y permisos

| Modalidad | Alcance |
|---|---|
| Gratis | Himnario autorizado, funciones locales y contenido marcado gratuito |
| Premium | Suscripción temporal con beneficios publicados: contenido autorizado, offline cifrado, sync de Mi Música y dispositivos según política |
| Audio descargable | Compra web separada: MP3/WAV por álbum, catálogo o pista habilitada |
| Permiso adicional | Usos concretos por pista elegible, con precio y términos aceptados |
| Promocional/canje | Entitlement explícito con origen, alcance y vencimiento cuando aplique |

Premium no concede automáticamente paquetes de audio ni derechos de composición.
La descarga básica solo incluye los archivos y usos enumerados; no habilita por
defecto grabar una voz encima.

Cada artista define permisos por defecto y cada pista puede sobrescribirlos. El
carrito muestra “Permiso para grabar y publicar” únicamente en pistas elegibles,
con usos y precio por pista. Covers o pistas sin autorización suficiente no ofrecen
estas opciones. La compra no transfiere autoría ni copropiedad.

En YouTube pueden existir reclamos de otros titulares. Soporte registrará URL,
claim ID, orden y licencia, y el artista ayudará cuando tenga autoridad para ello;
no se garantiza ausencia de reclamos, liberación ni monetización.

## 5. Composición y producción por encargo

Es un servicio separado de la tienda de descargas: solicitud → cotización →
aceptación/pago acordado → proyecto → entrega. El alcance, archivos y usos se
registran para cada cliente.

## 6. Pagos y entrega digital

El método inicial es QR/transferencia con comprobante privado y aprobación manual
auditada. La aprobación en backend confirma el pago y crea, en una operación
idempotente, el entitlement o periodo Premium. Subir una imagen nunca activa acceso.

La arquitectura prevé adaptadores futuros para Binance, Google Play Billing, Apple
IAP y QR dinámico. Cada proveedor conserva sus referencias y estados verificados;
no se fuerza un ciclo de renovación universal. Antes de habilitar checkout o enlaces
desde apps distribuidas en tiendas se revisarán sus reglas vigentes.

Los masters y archivos completos son privados; previews son activos derivados
independientes y públicos. La API emite URLs firmadas breves tras comprobar acceso.
La separación vocal y otros derivados se procesan en workers, conservan herramienta,
versión y parámetros, y requieren revisión humana antes de publicarse.

## 7. Biblioteca personal y PDFs

Mi Música y repertorios pueden sincronizarse según los beneficios de la cuenta. En
cambio, los PDFs personales importados por el músico permanecen únicamente en el
almacenamiento privado del dispositivo: no se suben, no se sincronizan y Premium no
incluye su respaldo. La app debe advertir la pérdida posible al cambiar de equipo y
puede ofrecer exportación/backup local.

## 8. Módulos de API

| Módulo | Responsabilidades | Fase |
|---|---|---|
| `system`, `auth` | Salud, OpenAPI e identidad GoTrue | 1 |
| `profiles` | Perfiles, roles y dispositivos | 2 |
| `catalog`, `himnario` | Catálogo, enlaces y versiones de himnos | 2-3 |
| `library` | Mi Música, favoritos y repertorios | 3 |
| `store`, `payments` | Productos, ofertas, órdenes, pagos y acceso | 3 |
| `tracks`, `media`, `licenses` | Audio, activos, permisos y descargas | 3 |
| `services` | Solicitudes y entregas de composición/producción | 3+ |
| `support` | Tickets, mensajes y reclamos | 3+ |
| `sync`, `downloads` | Sync incremental y licencias offline | 4 |
| `notifications` | In-app y FCM | 4 |
| `telemetry`, `admin` | Uso, auditoría y operación staff | 3-4 |

## 9. Requerimientos no funcionales

- API Go modular, PostgreSQL único, S3-compatible y worker separable.
- OpenAPI generado con Huma, endpoints `/api/v1` y errores consistentes.
- JWT GoTrue y autorización de negocio exclusivamente en backend.
- Importes enteros en unidades menores, moneda ISO e idempotencia de pagos.
- Auditoría de precios, paquetes, permisos, pagos, acceso, reembolsos y roles.
- Validación y límites de cargas, rate limiting, logs sin secretos y HTTPS.
- Tests unitarios e integración con PostgreSQL; backups externos y restauración
  comprobada.

## 10. Fases

1. **Fundamentos:** esqueleto Go, PostgreSQL, auth, OpenAPI, health y CI.
2. **Modelo y base de negocio:** núcleo de datos, catálogo e himnario de lectura.
3. **Contenido y comercio:** portal web, tienda de audio, Premium, pagos manuales,
   licencias, servicios, soporte y S3.
4. **Procesamiento y sync:** worker, PDF→ChordPro editorial, derivados de audio,
   sync, descargas offline y FCM.
5. **Clientes y producción:** panel/app v2, seguridad, carga y operación.

## 11. Fuera del alcance inicial

- Streaming completo o reproducción alojada solo por disponer de un enlace externo.
- Sincronización o almacenamiento en nube de PDFs personales.
- Liquidaciones automáticas de comisiones: primero se registran y liquidan manualmente.
- WebSockets, microservicios, una segunda base musical o integración inmediata de
  todos los proveedores de pago.
- Alineación letra/audio en servidor hasta definir granularidad y comportamiento.
- Publicación o venta de contenido sin los permisos aplicables.

Las decisiones de derechos del himnario, transcripciones, artistas y usos comerciales
son requisitos previos de publicación/venta, no bloquean las primeras migraciones.
