# trio-mision-landing-page

Sitio web de Trio Misión Bolivia, construido con Astro.

## Desarrollo local

```sh
pnpm install
pnpm dev
```

## Comprobación

```sh
pnpm check
```

## Despliegue en Dokploy

1. Crea una aplicación desde el repositorio y selecciona la rama `main`.
2. Selecciona **Dockerfile** como tipo de build y deja `Dockerfile` como ruta.
3. Configura el puerto destino del dominio en `80`.

El `Dockerfile` compila Astro y sirve `dist/` con Nginx. `.dockerignore` excluye
dependencias locales y archivos de desarrollo del contexto de construcción.
