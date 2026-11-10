package importaciones

import "testing"

func TestReemplazarDirectiva(t *testing.T) {
	base := "{title: Vieja}\n{key: C}\n\n[C]Hola"
	if got := reemplazarDirectiva(base, "title", "Nueva"); got != "{title: Nueva}\n{key: C}\n\n[C]Hola" {
		t.Errorf("reemplazo: %q", got)
	}
	if got := reemplazarDirectiva(base, "capo", "3"); got != "{capo: 3}\n{title: Vieja}\n{key: C}\n\n[C]Hola" {
		t.Errorf("insercion: %q", got)
	}
	if got := reemplazarDirectiva(base, "key", ""); got != "{title: Vieja}\n\n[C]Hola" {
		t.Errorf("quitar: %q", got)
	}
}
