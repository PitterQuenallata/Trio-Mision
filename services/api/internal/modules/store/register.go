package store

import (
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// ttlSubidaComprobante es la validez de la URL firmada de subida.
const ttlSubidaComprobante = 10 * time.Minute

// Register registra los endpoints de la tienda y las compras del usuario.
// presignTTL es la validez de las URLs firmadas de descarga (config S3).
func Register(api huma.API, db database.DB, store storage.Client, presignTTL time.Duration) {
	huma.Register(api, huma.Operation{
		OperationID: "tienda-listar-ofertas",
		Method:      http.MethodGet,
		Path:        "/api/v1/tienda/ofertas",
		Summary:     "Ofertas vigentes de la tienda",
		Description: "Ofertas activas con producto activo: audio con al menos una pista publicada " +
			"(pistas_total) y premium con plan activo (plan). Importes enteros en unidades menores con moneda ISO.",
		Tags: []string{"tienda"},
	}, listarOfertas(db, store))

	huma.Register(api, huma.Operation{
		OperationID: "tienda-listar-planes",
		Method:      http.MethodGet,
		Path:        "/api/v1/tienda/planes",
		Summary:     "Planes Premium activos",
		Description: "Planes con duración y beneficios publicados. Premium es un período temporal: " +
			"no incluye audio descargable ni permisos de uso.",
		Tags: []string{"tienda"},
	}, listarPlanes(db))

	huma.Register(api, huma.Operation{
		OperationID: "tienda-obtener-pista",
		Method:      http.MethodGet,
		Path:        "/api/v1/tienda/pistas/{id}",
		Summary:     "Detalle de una pista en venta",
		Description: "Pista publicada con URL pública del preview y sus ofertas vigentes.",
		Tags:        []string{"tienda"},
	}, obtenerPista(db, store))

	huma.Register(api, huma.Operation{
		OperationID: "tienda-crear-orden",
		Method:      http.MethodPost,
		Path:        "/api/v1/tienda/ordenes",
		Summary:     "Crear una orden de compra",
		Description: "Congela oferta, producto y contenido (pista/plan y archivos) en una orden. " +
			"Acepta coupon_code opcional: el descuento se calcula en backend (subtotal, descuento, total) " +
			"y jamás produce totales negativos. Idempotente por idempotency_key: un reintento con la misma " +
			"clave y la misma oferta/cupón devuelve la orden original; con otros datos devuelve 409.",
		Tags:     []string{"tienda"},
		Security: []map[string][]string{{"bearer": {}}},
	}, crearOrden(db))

	huma.Register(api, huma.Operation{
		OperationID: "tienda-canje",
		Method:      http.MethodPost,
		Path:        "/api/v1/tienda/canjes",
		Summary:     "Canjear un código",
		Description: "Canjea un código de canje válido y concede un período Premium o entitlements de un " +
			"paquete (grant_source=redemption), sin crear pago. Idempotente: repetir el mismo código con el " +
			"mismo usuario devuelve el canje original sin consumir otro uso ni duplicar efectos.",
		Tags:     []string{"tienda"},
		Security: []map[string][]string{{"bearer": {}}},
	}, canjear(db))

	huma.Register(api, huma.Operation{
		OperationID: "tienda-obtener-orden",
		Method:      http.MethodGet,
		Path:        "/api/v1/tienda/ordenes/{id}",
		Summary:     "Detalle de una orden propia",
		Description: "Orden con sus ítems (snapshots congelados) e intentos de pago. Solo el titular.",
		Tags:        []string{"tienda"},
		Security:    []map[string][]string{{"bearer": {}}},
	}, obtenerOrden(db))

	huma.Register(api, huma.Operation{
		OperationID: "tienda-crear-pago",
		Method:      http.MethodPost,
		Path:        "/api/v1/tienda/ordenes/{id}/pagos",
		Summary:     "Registrar intento de pago manual",
		Description: "Crea un intento QR/transferencia para una orden propia pendiente y vigente. " +
			"El monto debe coincidir con el total. Idempotencia por orden y clave; reutilizarla con otros datos devuelve 409.",
		Tags:     []string{"tienda"},
		Security: []map[string][]string{{"bearer": {}}},
	}, crearPago(db))

	huma.Register(api, huma.Operation{
		OperationID:  "tienda-subir-comprobante",
		Method:       http.MethodPost,
		Path:         "/api/v1/tienda/pagos/{pagoId}/comprobante",
		Summary:      "Subir comprobante de pago",
		Description:  "Multipart autenticado con imagen JPEG, PNG o WebP de máximo 5 MiB. Guarda en almacenamiento privado y marca el pago en revisión.",
		MaxBodyBytes: maxComprobanteBytes + 64*1024,
		Tags:         []string{"tienda"},
		Security:     []map[string][]string{{"bearer": {}}},
	}, subirComprobante(db, store))

	huma.Register(api, huma.Operation{
		OperationID: "tienda-mis-compras",
		Method:      http.MethodGet,
		Path:        "/api/v1/mis-compras",
		Summary:     "Mis compras, accesos y suscripciones",
		Description: "Compras pagadas, entitlements y suscripciones del usuario autenticado. " +
			"premium_activo se calcula por tiempo (período vigente ahora); Premium no crea entitlements de audio.",
		Tags:     []string{"tienda"},
		Security: []map[string][]string{{"bearer": {}}},
	}, misCompras(db))

	huma.Register(api, huma.Operation{
		OperationID: "tienda-descarga",
		Method:      http.MethodGet,
		Path:        "/api/v1/mis-compras/accesos/{id}/descarga",
		Summary:     "URL firmada de descarga",
		Description: "Emite una URL firmada breve del master solo con un entitlement vigente. " +
			"Sin entitlement, revocado o vencido → 403/404.",
		Tags:     []string{"tienda"},
		Security: []map[string][]string{{"bearer": {}}},
	}, descarga(db, store, presignTTL))
}
