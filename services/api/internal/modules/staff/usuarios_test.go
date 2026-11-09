package staff

import "testing"

func TestEscaparLike(t *testing.T) {
	casos := map[string]string{
		"ana":  "ana",
		"100%": `100\%`,
		"a_b":  `a\_b`,
		`c\d`:  `c\\d`,
		"%_\\": `\%\_\\`,
	}
	for entrada, esperado := range casos {
		if got := escaparLike(entrada); got != esperado {
			t.Errorf("escaparLike(%q) = %q, se esperaba %q", entrada, got, esperado)
		}
	}
}
