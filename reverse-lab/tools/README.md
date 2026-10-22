# Tools — Reverse Lab

Utilidades y scripts de apoyo para los análisis del laboratorio.

- `scripts/` — scripts reutilizables.
- `rea/` — clon de [morluto/rea](https://github.com/morluto/rea) (MIT), herramienta de ingeniería inversa. **Fuera de git** (código de terceros, no se vendorea); re-obtener con `git clone https://github.com/morluto/rea.git reverse-lab/tools/rea`.
- `ghidra/` — Ghidra extraído (NSA, Apache-2.0), motor de análisis nativo para REA. **Fuera de git** (~1 GB); re-obtener descargando el zip público de [Ghidra releases](https://github.com/NationalSecurityAgency/ghidra/releases) y extrayéndolo aquí como `ghidra/`.

## Configuración del entorno

REA se instala globalmente con npm: `npm install --global rea-agents`. Requiere Java 21 (`brew install openjdk@21`) y las variables:

```sh
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
export GHIDRA_INSTALL_DIR="$PWD/reverse-lab/tools/ghidra"   # ruta absoluta en cada máquina
```

Verificar con `rea doctor`.
