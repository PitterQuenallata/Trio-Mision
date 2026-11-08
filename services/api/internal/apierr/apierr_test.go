package apierr

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

// La respuesta de un 500 no debe contener el texto del error interno.
func TestInternalNoFiltraDetalle(t *testing.T) {
	secreto := errors.New(`ERROR: relation "push_tokens" does not exist (SQLSTATE 42P01)`)
	e := Internal("error registrando el token push", secreto)

	raw, err := json.Marshal(e)
	if err != nil {
		t.Fatal(err)
	}
	body := string(raw)
	for _, filtrado := range []string{"push_tokens", "SQLSTATE", "relation"} {
		if strings.Contains(body, filtrado) {
			t.Fatalf("la respuesta 500 filtra %q: %s", filtrado, body)
		}
	}
	if !strings.Contains(body, "error registrando el token push") {
		t.Fatalf("el mensaje genérico debe conservarse: %s", body)
	}
	if e.GetStatus() != 500 {
		t.Fatalf("status: %d", e.GetStatus())
	}
}
