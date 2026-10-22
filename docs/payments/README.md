# Pagos y suscripciones — Trio Misión

> **Estado:** documento de estrategia. Aún no existe integración de pagos implementada.

## 1. Estrategia

Trio Misión ofrecerá suscripciones Premium mediante distintos métodos de pago. La implementación será gradual, comenzando con pagos sencillos en Bolivia y avanzando hacia integraciones automatizadas.

## 2. Métodos de pago

### 2.1. QR bancario y transferencia — Bolivia

**Primera etapa.**

- Generar o proporcionar un QR para el período de suscripción seleccionado, por ejemplo, mensual.
- Permitir pagos mediante transferencia bancaria.
- Registrar el usuario, plan, importe y período contratado.
- Verificar manualmente los pagos en esta primera etapa.
- Activar Premium después de confirmar el pago.
- Registrar la fecha de inicio y vencimiento de la suscripción.

Inicialmente no se requiere una API bancaria para generar cobros dinámicos.

### 2.2. Binance

Se incorporará Binance como método de pago adicional.

La integración deberá permitir identificar las transacciones, verificar los importes recibidos y actualizar el estado de la suscripción de manera segura.

### 2.3. Google Play Billing

Se incorporará Google Play Billing para las suscripciones digitales de la aplicación Android distribuida mediante Google Play, conforme a las políticas aplicables.

El backend deberá verificar las compras y mantener actualizado el estado de la suscripción.

### 2.4. Apple In-App Purchase

Se incorporará Apple In-App Purchase para las suscripciones digitales de la aplicación iOS, conforme a las políticas aplicables de Apple.

El backend deberá verificar las transacciones y gestionar las renovaciones, vencimientos y cancelaciones.

## 3. QR dinámico mediante API — fase futura

En una etapa posterior se integrará un proveedor de pagos QR compatible con Bolivia.

El objetivo es generar un QR único por transacción, asociado al importe exacto, para facilitar pagos rápidos y automatizar la confirmación.

Flujo previsto:

1. El usuario selecciona su plan.
2. El backend crea una orden de pago con identificador e importe únicos.
3. El proveedor genera el QR dinámico.
4. El usuario escanea el QR y paga.
5. El proveedor confirma la transacción mediante webhook o consulta autenticada.
6. El backend valida el pago y activa o renueva Premium.
7. La web y las aplicaciones reflejan el estado actualizado.

La elección del proveedor y la integración técnica se realizarán en esta fase futura.

## 4. Gestión de suscripciones

La API será la fuente de verdad para el acceso Premium.

Se distinguirán:

- **Orden de pago:** solicitud de cobro de un plan.
- **Pago:** estado de la transacción.
- **Suscripción:** período de acceso concedido al usuario.

Los usuarios podrán consultar su estado de suscripción desde la web y las aplicaciones, respetando las reglas de cada plataforma.

## 5. Seguridad

- Mantener las credenciales privadas exclusivamente en el backend.
- Verificar las transacciones antes de conceder acceso Premium.
- Evitar procesar una misma transacción más de una vez.
- Registrar importes, moneda, referencias y estados.
- Separar los entornos de pruebas de los pagos reales.
- Respetar las políticas vigentes de Google Play y Apple.

## 6. Roadmap

| Etapa | Funcionalidad | Prioridad |
|---|---|---|
| 1 | QR bancario y transferencia con verificación manual | Inicial |
| 2 | Binance | Futuro |
| 3 | Google Play Billing | Futuro |
| 4 | Apple In-App Purchase | Futuro |
| 5 | API QR dinámica con importe exacto y confirmación automática | Futuro |

Las suscripciones y los pagos se diseñarán desde el inicio para que estos métodos puedan incorporarse sin rehacer la arquitectura del backend.
