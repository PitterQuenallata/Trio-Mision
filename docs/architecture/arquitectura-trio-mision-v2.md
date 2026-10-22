# Arquitectura objetivo --- Trio Misión (Versión 2)

> **Objetivo:** definir una arquitectura preparada para crecer, con
> costos controlables y posibilidad de operar en infraestructura propia.
> La prioridad es construir una base sostenible a largo plazo, sin
> depender innecesariamente de servicios administrados caros ni
> introducir complejidad que el producto todavía no necesita.

## 1. Decisiones principales

-   **Arquitectura elegida:** Opción B --- backend propio y servicios
    desplegables en infraestructura propia.
-   **Backend:** Go, organizado como una aplicación modular y expuesto
    mediante una API.
-   **Base de datos:** PostgreSQL.
-   **Autenticación inicial:** GoTrue autohospedado, como servicio
    independiente. No es necesario autohospedar toda la plataforma
    Supabase.
-   **Archivos:** almacenamiento compatible con S3. Se puede empezar con
    un proveedor compatible y migrar a almacenamiento propio cuando
    tenga sentido operativo.
-   **Notificaciones push:** Firebase Cloud Messaging (FCM), que ya
    forma parte del producto.
-   **Cliente móvil:** aplicación con persistencia y caché local;
    sincronización con el servidor cuando hay conexión.
-   **Panel administrativo:** aplicación web que consume la API del
    backend.
-   **Procesamiento pesado:** tareas asíncronas para conversiones
    masivas de PDF a formato ChordPro y otros trabajos que no deban
    bloquear una petición web.
-   **Tiempo real:** no es requisito inicial. Se prioriza sincronización
    explícita y eficiente.

## 2. Principios de diseño

1.  **Pensar a futuro sin sobredimensionar el comienzo.** La
    arquitectura debe permitir crecer, pero no necesita microservicios
    para cada módulo desde el primer día.
2.  **Costos previsibles.** Evitar que el crecimiento dependa de tarifas
    por usuario, operación o transferencia difíciles de anticipar.
3.  **Control de los datos.** La base de datos y la lógica principal del
    negocio deben estar bajo control del proyecto.
4.  **Componentes reemplazables.** El almacenamiento, el servicio de
    autenticación y otros proveedores deben poder sustituirse mediante
    interfaces claras.
5.  **Seguridad por defecto.** La API valida permisos y reglas de
    negocio; el cliente no es una fuente confiable de autorización.
6.  **Sincronización antes que tiempo real.** La aplicación debe
    funcionar con datos locales y sincronizar cambios cuando sea
    necesario.
7.  **Operación sencilla.** Empezar con un despliegue mantenible, copias
    de seguridad verificadas, monitoreo y procedimientos de
    recuperación.

## 3. Diagrama general

``` mermaid
flowchart TB
    Mobile[Aplicación móvil]
    Admin[Panel administrativo web]
    Auth[GoTrue autohospedado]
    API[API propia en Go]
    DB[(PostgreSQL)]
    Storage[Almacenamiento S3-compatible]
    Queue[Cola de tareas]
    Worker[Procesadores en segundo plano]
    FCM[Firebase Cloud Messaging]

    Mobile -->|Inicio de sesión| Auth
    Admin -->|Inicio de sesión| Auth
    Mobile -->|Token + solicitudes| API
    Admin -->|Token + solicitudes| API
    API --> DB
    API --> Storage
    API --> Queue
    Queue --> Worker
    Worker --> DB
    Worker --> Storage
    API --> FCM
    Worker --> FCM
```

El diagrama representa los límites lógicos. En una primera etapa, la API
y el procesador de tareas pueden desplegarse en el mismo servidor o
proyecto de despliegue, aunque deben conservar responsabilidades
separadas en el código.

## 4. Componentes

### 4.1 Aplicación móvil

Responsabilidades:

-   Mostrar letras, acordes, tablaturas y contenido musical.
-   Permitir transposición y uso de contenido descargado.
-   Mantener una base de datos local o caché persistente.
-   Permitir consultar contenido previamente sincronizado sin conexión.
-   Enviar cambios y solicitudes al backend cuando haya conectividad.
-   Guardar de forma segura los tokens de sesión.
-   Recibir notificaciones mediante FCM.

La aplicación no debe conectarse directamente a PostgreSQL ni contener
secretos de servidor. Todas las operaciones protegidas pasan por la API.

### 4.2 Panel administrativo web

Responsabilidades:

-   Administrar contenido musical, usuarios y metadatos.
-   Gestionar importaciones y conversiones masivas.
-   Consultar el estado y los errores de las tareas.
-   Consumir la misma API que usa la aplicación móvil.
-   Aplicar controles de interfaz según el rol, sin depender de ellos
    como única barrera de seguridad.

El panel no debe tener credenciales de base de datos ni privilegios
administrativos incrustados en el navegador.

### 4.3 API propia en Go

La API concentra la lógica del negocio y es la autoridad para las
operaciones protegidas.

Responsabilidades:

-   Verificar tokens emitidos por GoTrue.
-   Aplicar autorización y permisos por recurso y acción.
-   Validar datos de entrada.
-   Gestionar catálogo, contenido, usuarios y operaciones
    administrativas.
-   Coordinar las lecturas y escrituras en PostgreSQL.
-   Emitir solicitudes de trabajo asíncrono.
-   Controlar el acceso a archivos.
-   Exponer endpoints versionados y documentados.

**Recomendación inicial:** un monolito modular en Go. Separar módulos
dentro del código, sin distribuirlos prematuramente en numerosos
servicios. Si una parte necesita escalar de forma independiente en el
futuro, se podrá extraer con una frontera bien definida.

### 4.4 PostgreSQL

PostgreSQL es la fuente de verdad para los datos estructurados del
producto.

Debe almacenar, según el modelo final:

-   Usuarios internos y perfiles de aplicación.
-   Roles, permisos y relaciones de autorización.
-   Catálogo musical y metadatos.
-   Letras, acordes, tablaturas y contenido normalizado.
-   Versiones, estados de publicación y fechas de modificación.
-   Referencias a archivos almacenados externamente.
-   Historial de tareas, errores y auditoría cuando corresponda.
-   Metadatos necesarios para sincronización incremental.

No se deben guardar archivos multimedia grandes como blobs en la base de
datos sin una razón concreta. Es preferible guardar el archivo en
almacenamiento de objetos y conservar en PostgreSQL su clave, tipo,
tamaño, checksum y metadatos.

### 4.5 GoTrue autohospedado

GoTrue es el servicio de autenticación de Supabase. Puede desplegarse de
forma independiente; usarlo **no obliga a desplegar toda la plataforma
Supabase**.

Puede encargarse de:

-   Registro e inicio de sesión.
-   Gestión de sesiones y emisión/renovación de tokens.
-   Flujos de recuperación de cuenta y correo, según la configuración
    elegida.
-   Proveedores de identidad que se habiliten en el futuro.

La API propia debe validar los tokens y resolver la identidad del
usuario antes de ejecutar operaciones protegidas. La autorización de
negocio ---por ejemplo, quién puede publicar contenido o administrar
usuarios--- debe definirse de forma explícita en la aplicación, no
quedar implícita en que alguien haya iniciado sesión.

**Decisión:** comenzar con GoTrue autohospedado para no tener que
implementar desde cero toda la gestión de credenciales y sesiones.

**Aspectos operativos que hay que resolver:**

-   Configuración segura de claves y secretos.
-   Dominio, HTTPS y URLs de redirección.
-   SMTP o proveedor de correo transaccional para recuperación y
    verificación, si se habilitan.
-   Políticas de expiración y renovación de sesión.
-   Copias de seguridad y actualización de versiones.
-   Procedimiento de recuperación ante pérdida de configuración o
    claves.

GoTrue es una dependencia importante: conviene fijar versiones,
documentar su configuración y probar actualizaciones antes de aplicarlas
en producción.

### 4.6 Almacenamiento de archivos

Se utilizará una interfaz de almacenamiento compatible con S3 para
desacoplar la API del proveedor.

Posibles usos:

-   Archivos PDF originales.
-   Archivos generados o convertidos.
-   Portadas, imágenes y otros recursos.
-   Archivos descargables del catálogo.

La API debe decidir quién puede acceder a cada archivo. Para contenido
privado, se pueden emitir enlaces firmados con vencimiento o servir el
archivo mediante un endpoint autorizado. Los secretos de almacenamiento
nunca deben exponerse en el cliente.

**Estrategia recomendada:**

1.  Definir desde el comienzo una interfaz S3-compatible.
2.  Empezar con el proveedor o servidor que resulte más conveniente en
    costo y operación.
3.  Evaluar almacenamiento propio ---por ejemplo, una implementación
    compatible con S3--- cuando el volumen, la transferencia y la
    capacidad operativa lo justifiquen.
4.  Mantener una política de backups independiente del almacenamiento
    principal.

No es necesario incorporar un servicio de almacenamiento específico de
Supabase para usar GoTrue. La elección de almacenamiento puede ser
independiente.

### 4.7 Trabajos asíncronos

La conversión masiva de PDF a ChordPro y otros trabajos pesados no deben
ejecutarse dentro de una petición HTTP larga.

Flujo propuesto:

1.  Un administrador solicita una importación.
2.  La API valida la petición y registra una tarea.
3.  La API coloca la tarea en una cola.
4.  Un trabajador procesa el archivo.
5.  El trabajador registra resultado, progreso o error.
6.  El panel consulta el estado y permite reintentar tareas fallidas de
    forma segura.

La cola concreta se elige según la necesidad real. Para una primera
versión puede usarse una solución sencilla y mantenible; no hace falta
añadir infraestructura compleja hasta conocer el volumen de trabajo. Las
tareas deben diseñarse para tolerar reintentos sin duplicar
publicaciones ni corromper datos.

### 4.8 Notificaciones push

FCM se mantiene para enviar notificaciones a los dispositivos.

El backend debe guardar los tokens de dispositivos asociados a usuarios,
gestionar tokens inválidos y registrar resultados de envío cuando sea
necesario. Las credenciales de FCM deben permanecer exclusivamente en el
servidor.

FCM sirve para avisar de cambios; no debe ser la fuente de verdad del
contenido ni el mecanismo principal de sincronización.

## 5. Sincronización y modo sin conexión

Como no se necesita tiempo real al inicio, la sincronización puede ser
incremental.

Principios:

-   El cliente conserva localmente el contenido descargado.
-   Cada registro sincronizable dispone de una marca de modificación o
    versión.
-   La API ofrece una forma de solicitar los cambios posteriores a un
    cursor o marca de tiempo.
-   Las respuestas incluyen un cursor estable para continuar la
    siguiente sincronización.
-   Las eliminaciones deben representarse de una forma que el cliente
    pueda detectar, por ejemplo mediante tombstones o un registro de
    cambios.
-   Las operaciones de escritura deben ser idempotentes cuando sea
    posible.
-   Debe definirse qué ocurre si el mismo dato se modifica en dos
    dispositivos.

Una estrategia inicial posible es que el servidor sea la autoridad para
el contenido publicado y que el móvil sincronice descargas y cambios de
cuenta. Si más adelante se permite editar datos desde varios
dispositivos sin conexión, habrá que diseñar reglas explícitas de
resolución de conflictos.

No se debe agregar WebSockets ni replicación en tiempo real hasta que
exista un caso de uso real que lo justifique.

## 6. Seguridad

-   HTTPS obligatorio para todas las comunicaciones externas.
-   Tokens validados por la API y autorización aplicada en cada
    operación protegida.
-   Roles y permisos definidos en el backend.
-   Validación estricta de entradas y límites de tamaño para cargas.
-   Protección contra abuso: límites de frecuencia donde sean
    necesarios.
-   Secretos almacenados en variables protegidas o un gestor de
    secretos, nunca en el repositorio.
-   Separación de entornos de desarrollo, pruebas y producción.
-   Registro de eventos de seguridad y acciones administrativas
    importantes.
-   Actualización planificada de Go, PostgreSQL, GoTrue y dependencias.
-   Acceso a infraestructura mediante claves y permisos mínimos.
-   Política de retención y eliminación de datos definida antes de
    producción.

La autenticación demuestra quién es el usuario; la autorización decide
qué puede hacer. Son responsabilidades distintas.

## 7. Despliegue e infraestructura

### Primera etapa

Un VPS propio puede alojar los servicios iniciales si tiene recursos
suficientes y se administra correctamente. Una disposición inicial
podría incluir:

-   Proxy inverso con HTTPS.
-   API en Go.
-   GoTrue.
-   PostgreSQL.
-   Trabajador de tareas.
-   Cola, si la solución seleccionada la requiere.
-   Monitoreo y sistema de logs.

El almacenamiento de archivos puede estar en el mismo servidor al
principio solo si se comprende el riesgo y existe una estrategia de
copia externa. Para archivos importantes, evitar que la única copia viva
en el mismo disco que la aplicación.

Los servicios pueden ejecutarse en contenedores para hacer reproducibles
los despliegues, pero la tecnología concreta de orquestación debe
mantenerse simple al inicio.

### Crecimiento

A medida que aumente el uso, se puede:

1.  Separar el trabajador de tareas de la API.
2.  Mover PostgreSQL a un servidor dedicado o servicio administrado si
    mejora la disponibilidad.
3.  Separar el almacenamiento de objetos.
4.  Añadir réplicas de la API detrás del proxy.
5.  Introducir caché cuando las mediciones indiquen que hace falta.
6.  Extraer servicios solo cuando haya razones medibles de escala,
    aislamiento o despliegue independiente.

La arquitectura no debe depender de que todos estos pasos se hagan desde
el primer día.

## 8. Backups y recuperación

La operación de producción debe incluir:

-   Copias de seguridad automáticas de PostgreSQL.
-   Copias externas al VPS principal.
-   Versionado o protección contra borrado accidental para archivos
    importantes, cuando sea posible.
-   Cifrado y control de acceso a las copias.
-   Retención definida según la importancia de los datos.
-   Pruebas periódicas de restauración.
-   Documentación de recuperación ante caída del VPS o pérdida de datos.

Una copia de seguridad que nunca se ha restaurado en una prueba no debe
considerarse una estrategia de recuperación verificada.

## 9. Observabilidad y mantenimiento

Como mínimo, medir y registrar:

-   Disponibilidad y latencia de la API.
-   Errores por endpoint.
-   Uso de CPU, memoria, disco y red.
-   Espacio libre y conexiones de PostgreSQL.
-   Fallos y duración de las tareas asíncronas.
-   Estado de las copias de seguridad.
-   Errores de autenticación y de envío de notificaciones, con cuidado
    de no registrar secretos ni tokens completos.

Definir alertas para fallos críticos y documentar procedimientos básicos
de mantenimiento, actualización y restauración.

## 10. Costos: enfoque de control

El costo total no es solo el precio mensual del VPS. También incluye
almacenamiento, transferencia, correo transaccional, backups, monitoreo
y el tiempo necesario para mantener los servicios.

Para controlar los costos:

-   Medir uso real antes de contratar recursos mayores.
-   Evitar dependencias con tarifas imprevisibles por operación cuando
    exista una alternativa razonable.
-   Vigilar el tráfico de descargas y el almacenamiento.
-   Establecer límites y alertas de uso.
-   Mantener un plan de migración para cada proveedor externo
    importante.
-   No autohospedar un servicio solo porque su licencia o software sea
    gratuito: considerar también mantenimiento, disponibilidad y
    seguridad.

FCM se conserva para notificaciones push. GoTrue se autohospeda para
autenticación. La base de datos y la lógica de negocio quedan bajo
control del proyecto. El almacenamiento puede ser propio o externo
compatible con S3 según el costo total y la capacidad operativa.

## 11. Fases de implementación

### Fase 1 --- Fundamentos

-   Definir dominios y entornos.
-   Preparar despliegue reproducible.
-   Configurar HTTPS, secretos, logs y monitoreo básico.
-   Desplegar PostgreSQL y GoTrue autohospedado.
-   Probar registro, inicio de sesión, renovación y recuperación de
    cuenta.
-   Establecer backups y probar una restauración.

### Fase 2 --- API y modelo de datos

-   Definir el modelo de datos y sus migraciones.
-   Implementar la API modular en Go.
-   Verificar tokens de GoTrue.
-   Implementar perfiles, roles y permisos en el backend.
-   Documentar los endpoints y establecer pruebas automatizadas.

### Fase 3 --- Contenido y almacenamiento

-   Implementar catálogo y publicación de contenido.
-   Integrar almacenamiento S3-compatible.
-   Definir autorización de descargas.
-   Implementar importación de archivos y validaciones.

### Fase 4 --- Procesamiento y sincronización

-   Crear la cola y los trabajadores de tareas.
-   Implementar conversión de PDF a ChordPro con seguimiento de estado.
-   Añadir sincronización incremental y manejo de eliminaciones.
-   Probar reintentos, desconexiones y conflictos.

### Fase 5 --- Panel, móvil y producción

-   Conectar el panel administrativo a la API.
-   Conectar la aplicación móvil a la API y a la persistencia local.
-   Integrar FCM con tokens de dispositivo administrados por el
    servidor.
-   Ejecutar pruebas de seguridad, carga y recuperación.
-   Documentar despliegue, actualización y respuesta ante incidentes.

## 12. Decisiones que deben quedar documentadas

Antes de producción, confirmar explícitamente:

-   Proveedor de VPS y capacidad inicial.
-   Dominio, DNS y certificado TLS.
-   Proveedor SMTP o servicio de correo.
-   Proveedor de almacenamiento S3-compatible y política de acceso.
-   Solución de cola de tareas.
-   Política de roles y permisos.
-   Esquema de sincronización y resolución de conflictos.
-   Retención de backups y objetivo de recuperación.
-   Política de versiones y actualizaciones de GoTrue.
-   Métricas y alertas operativas.

Estas decisiones pueden tomarse en fases; no todas necesitan resolverse
antes de construir el primer endpoint.

## 13. Fuera del alcance inicial

Para evitar complejidad prematura, no se consideran requisitos
iniciales:

-   Tiempo real mediante WebSockets.
-   Microservicios separados para cada módulo.
-   Kubernetes u orquestación compleja sin necesidad demostrada.
-   Un motor de búsqueda dedicado antes de que PostgreSQL resulte
    insuficiente.
-   Un sistema de eventos distribuido de gran escala.
-   Reemplazar FCM sin un motivo concreto.
-   Autohospedar toda la plataforma Supabase solo para disponer de
    autenticación.

Se podrán evaluar más adelante si aparecen requisitos medibles que lo
justifiquen.

## 14. Resumen de la arquitectura

  -----------------------------------------------------------------------
  Área                                Decisión inicial
  ----------------------------------- -----------------------------------
  Estilo                              Monolito modular con límites claros

  Backend                             Go

  Base de datos                       PostgreSQL

  Autenticación                       GoTrue autohospedado

  Archivos                            Interfaz S3-compatible

  Push                                Firebase Cloud Messaging

  Sincronización                      Incremental, con persistencia local

  Tiempo real                         No requerido inicialmente

  Tareas pesadas                      Cola y trabajadores asíncronos

  Infraestructura                     VPS propio al inicio, con opción de
                                      separar componentes

  Seguridad                           Tokens validados por API, permisos
                                      en backend y secretos protegidos

  Disponibilidad                      Backups externos y pruebas de
                                      restauración

  Escalabilidad                       Escalar componentes según métricas,
                                      sin microservicios prematuros
  -----------------------------------------------------------------------

**Decisión de dirección:** construir el producto alrededor de una API
propia y PostgreSQL, usar GoTrue como componente de autenticación
autohospedado y mantener el almacenamiento detrás de una interfaz
S3-compatible. Esta combinación conserva control sobre la lógica y los
datos, reduce la dependencia de una plataforma completa y deja abierta
la posibilidad de escalar por etapas.
