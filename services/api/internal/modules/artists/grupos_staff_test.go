package artists

import "testing"

func TestSlugify(t *testing.T) {
	casos := map[string]string{
		"Trio Misión":           "trio-mision",
		"  Coro  Polifónico  ":  "coro-polifonico",
		"Ñandú & Los Ángeles!!": "nandu-los-angeles",
		"ABBA 2026":             "abba-2026",
		"***":                   "",
	}
	for entrada, esperado := range casos {
		if got := slugify(entrada); got != esperado {
			t.Errorf("slugify(%q) = %q, se esperaba %q", entrada, got, esperado)
		}
	}
}

func TestValidarSlug(t *testing.T) {
	validos := []string{"ab", "trio-mision", "grupo-2026"}
	invalidos := []string{"", "a", "Trio", "trio_mision", "-trio", "trio-", "trio--misión"}
	for _, s := range validos {
		if err := validarSlug(s); err != nil {
			t.Errorf("validarSlug(%q) rechazó un slug válido: %v", s, err)
		}
	}
	for _, s := range invalidos {
		if err := validarSlug(s); err == nil {
			t.Errorf("validarSlug(%q) aceptó un slug inválido", s)
		}
	}
}

func TestValidarRedes(t *testing.T) {
	if err := validarRedes(map[string]string{"instagram": "https://instagram.com/trio", "web": "http://trio.test"}); err != nil {
		t.Fatalf("redes válidas rechazadas: %v", err)
	}
	casos := []map[string]string{
		{"myspace": "https://myspace.com/x"}, // red no admitida
		{"instagram": "javascript:alert(1)"}, // esquema peligroso
		{"web": "no-es-una-url"},             // sin host
	}
	for _, c := range casos {
		if err := validarRedes(c); err == nil {
			t.Errorf("validarRedes(%v) aceptó una red inválida", c)
		}
	}
}

func TestValidarComision(t *testing.T) {
	f := func(v float64) *float64 { return &v }
	if err := validarComision(true, nil); err == nil {
		t.Error("vender pistas sin comisión debe rechazarse")
	}
	if err := validarComision(false, nil); err != nil {
		t.Errorf("sin venta la comisión es opcional: %v", err)
	}
	for _, v := range []float64{5, 7.5, 10} {
		if err := validarComision(true, f(v)); err != nil {
			t.Errorf("comisión %v debe ser válida: %v", v, err)
		}
	}
	for _, v := range []float64{4.99, 10.01, 0, 50} {
		if err := validarComision(true, f(v)); err == nil {
			t.Errorf("comisión %v debe rechazarse", v)
		}
	}
}

func TestValidarPrefijoPortada(t *testing.T) {
	if err := validarPrefijoPortada("public/imagenes/grupo/abc.jpg"); err != nil {
		t.Errorf("clave válida rechazada: %v", err)
	}
	for _, k := range []string{"evidence/x.png", "public/imagenes/../../secreto", "public/otra/x.jpg"} {
		if err := validarPrefijoPortada(k); err == nil {
			t.Errorf("clave %q debe rechazarse", k)
		}
	}
}
