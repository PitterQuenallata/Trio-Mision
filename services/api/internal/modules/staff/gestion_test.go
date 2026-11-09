package staff

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestMapErrGestionTraduceErroresDeNegocio(t *testing.T) {
	casos := map[string]int{
		"ultimo_admin":        http.StatusConflict,
		"perfil_inexistente":  http.StatusNotFound,
		"artista_inexistente": http.StatusNotFound,
		"rol_invalido":        http.StatusUnprocessableEntity,
	}
	for msg, status := range casos {
		err := mapErrGestion(&pgconn.PgError{Message: msg})
		var se huma.StatusError
		if !errors.As(err, &se) {
			t.Fatalf("%s: no es un StatusError: %v", msg, err)
		}
		if se.GetStatus() != status {
			t.Errorf("%s: status = %d, se esperaba %d", msg, se.GetStatus(), status)
		}
	}
}

func TestMapErrGestionNoFiltraErroresInternos(t *testing.T) {
	err := mapErrGestion(errors.New("relación secreta_x no existe"))
	var se huma.StatusError
	if !errors.As(err, &se) {
		t.Fatalf("no es StatusError: %v", err)
	}
	if se.GetStatus() != http.StatusInternalServerError {
		t.Errorf("status = %d, se esperaba 500", se.GetStatus())
	}
	if msg := se.Error(); msg == "" || strings.Contains(msg, "secreta_x") {
		t.Errorf("mensaje del 500 inesperado: %q", msg)
	}
}
