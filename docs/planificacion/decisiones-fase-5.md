# Decisiones de negocio — Fase 5 (dueño del proyecto)

> Registradas el 2026-11-08 a partir de la conversación con el dueño. Son la
> referencia para el panel admin, la API y `apps/appweb`. Si algo cambia, se
> actualiza aquí primero.

## Accesos y roles

- **Staff del panel admin:** `admin`, `editor`, `vendedor`. Entran al panel admin.
- **Manager:** administra un artista. Entra al panel admin solo para su artista.
- **Member:** no entra al panel admin. Accede a su grupo desde `apps/appweb`.
- **Cuentas:** los usuarios se registran en `apps/appweb` (Google o correo).
  El panel admin **no** crea clientes.
  - Pendiente de confirmar: ¿el admin sigue creando cuentas *staff* desde el
    panel? Lo implementado hoy lo permite; la decisión dice "no se crean usuarios
    desde el panel".

## Membresía de grupo (member)

- Un usuario **reclama** ser miembro de un artista desde `appweb` y presenta
  evidencia.
- Tras revisión y verificación, se le concede acceso **Premium solo a ese grupo**.
- El acceso Premium de grupo **no** da acceso a la suscripción general ni a
  otros artistas.
- Pendiente de definir: quién revisa la solicitud (manager del artista, admin o
  ambos) y si la membresía caduca.

## Planes y suscripción

- Tres planes: **mensual, trimestral y anual**.
- Un member **no** tiene la suscripción general; solo el acceso a su grupo dentro
  de ella (regla anterior).

## Ventas y descuentos

- **Cupones:** descuento con código (ya implementado en la API).
- **Ofertas de lanzamiento y tipo Black Friday:** descuentos por ventana de
  fechas que aplican sin código. Ya existe la lectura pública
  (`GET /api/v1/tienda/ofertas`), pero **no hay gestión staff** todavía.
- **Ventas:** solo a usuarios registrados.
- Pendiente de confirmar: ¿"ventas" en el panel se refiere a la tienda de pistas y
  paquetes, o a los servicios (hacer pistas)?

## Pagos

- **Ahora:** pago manual (en persona). Se registra desde el panel por staff.
- **Producción:** se añadirá Google Play y una pasarela internacional.
- Los pagos y suscripciones se trabajan **casi al final** del plan.

## Orden de trabajo (propuesto, pendiente de confirmar)

Solo confirmado: pagos casi al final y servicios antes de pagos.

1. Catálogo y "Mi grupo" del manager (incluye carga de álbumes y canciones).
2. Importación de PDF e himnario (con edición por canción antes de publicar).
3. Servicios (completar el flujo del panel).
4. Soporte.
5. Auditoría.
6. Licencias y configuración comercial (planes, cupones, ofertas).
7. Pagos (manual) y suscripciones; después, pasarelas.

## Decisiones de grupos, álbumes y ventas (2026-11-08)

- **Cuentas:** los clientes se registran solos en appweb (Google o correo); el panel
  no los crea. Los **staff se crean desde el panel** (admin, editor, vendedor). Los
  **managers se vinculan** a un grupo; no se crean desde el panel.
- **Administración de contenido:** el admin tiene **control total** de grupos,
  álbumes y canciones. Algunos grupos no tendrán manager.
- **Venta de pistas:** el admin habilita la venta por grupo (interruptor manual).
  Los dos grupos iniciales la tienen. **No hay suscripción por grupo** (esa idea de
  la v1 se descartó): el único plan de pago es la suscripción de usuario.
  Pendiente: cómo se gana el derecho a vender para un grupo nuevo si no es por
  suscripción de grupo (¿decisión manual del admin?).
  Cada venta genera comisión para la plataforma del 5 al 10 %.
- **Canciones con pista:** una canción puede tener pista (karaoke o música sin voz)
  con precio individual. No todas las canciones la tienen. Las canciones con pista
  se marcan en la app.
- **Almacenamiento de pistas:** **local por ahora** (MinIO). Se cambiará a un
  proveedor externo solo por configuración cuando se decida. Entrega por correo
  como opción adicional.
- **Interfaz de grupos:** página de detalle con pestañas (Datos, Álbumes, Miembros,
  Ventas solo para admin). Crear grupo y editar datos rápidos, en modal.
- **Álbum:** página con la tabla de canciones. Cada canción tiene interruptor "tiene
  pista" y precio.

## Pendiente de definir
- Proveedor de almacenamiento externo para producción (R2, B2 o S3).
- Cómo se habilita a un grupo nuevo para vender pistas, si no hay suscripción de grupo.
