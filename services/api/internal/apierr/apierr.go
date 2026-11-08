// Package apierr construye errores de la API sin filtrar detalles internos.
//
// Huma incluye en la respuesta el texto de los errores que se le pasan
// (errors[].message). Un error de base de datos expondría nombres de tablas,
// restricciones o SQL. Internal registra el error completo en el log del
// servidor y responde solo el mensaje genérico.
package apierr

import (
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
)

// Internal devuelve un 500 con msg como único mensaje para el cliente. err se
// registra en el log del servidor, nunca en la respuesta.
func Internal(msg string, err error) huma.StatusError {
	slog.Error("error interno de la API", "mensaje", msg, "error", err)
	return huma.Error500InternalServerError(msg)
}
