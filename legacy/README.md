# Legacy — versiones v1 (solo referencia)

Clones independientes de los repositorios v1 del ecosistema. **No son parte del producto v2**: se conservan aquí como referencia para reutilizar componentes, contenido y decisiones al construir la v2 desde cero.

| Directorio | Origen | Qué es |
|---|---|---|
| `trio-mision-app/` | [PitterQuenallata/trio-mision-app](https://github.com/PitterQuenallata/trio-mision-app) | App móvil v1. La v2 (`apps/mobile`) se construirá desde cero reutilizando componentes de aquí. |
| `panelweb-triomision-lyrics/` | [PitterQuenallata/panelweb-triomision-lyrics](https://github.com/PitterQuenallata/panelweb-triomision-lyrics) | Panel admin v1. El v2 (`apps/admin`) será otro, con mejor manejo de contenido; este queda como referencia de lo que se quiere mejorar. |

Cada clone conserva su propio `.git` y su remoto original. Esta carpeta está **excluida del git del monorepo** (ver `.gitignore`); para re-obtenerla:

```bash
git clone https://github.com/PitterQuenallata/trio-mision-app.git legacy/trio-mision-app
git clone https://github.com/PitterQuenallata/panelweb-triomision-lyrics.git legacy/panelweb-triomision-lyrics
```
