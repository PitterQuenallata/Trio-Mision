// ══════════════════════════════════════════════════════════════
// CONFIG GLOBAL — única fuente de verdad de marca, contacto y nav.
// Si cambia un número o URL, se edita AQUÍ y se actualiza todo el sitio.
// ══════════════════════════════════════════════════════════════

export const site = {
  nombre: 'Trio Misión',
  pais: 'Bolivia',
  tagline: 'Tres generaciones · Una misión',
  descripcion:
    'Trio Misión Bolivia — trío de música cristiana adventista con más de 30 años de trayectoria.',
} as const

export const contacto = {
  whatsapp: '+591 79128536',
  whatsappUrl: 'https://wa.me/59179128536',
  lineas: [
    {
      nombre: 'Trio Misión · Santa Cruz',
      responsable: 'Gabriel Quenallata · Director general y fundador',
      telefono: '+591 79128536',
      whatsappUrl: 'https://wa.me/59179128536',
      correo: 'gabrielquenallata03@gmail.com',
    },
    {
      nombre: 'Trio Misión Nueva Generación · La Paz',
      responsable: '',
      telefono: '+591 74856988',
      whatsappUrl: 'https://wa.me/59174856988',
      correo: null,
    },
  ],
  soporte: {
    nombre: 'Pitter Quenallata',
    funcion: 'Programación, soporte técnico y administración web de Trio Misión',
    correo: 'quenallatapitteroficial@gmail.com',
  },
} as const

// Perfiles y plataformas con enlaces confirmados por el grupo.
export const redes = [
  { nombre: 'YouTube', grupo: 'Trio Misión', icono: 'youtube', url: 'https://www.youtube.com/@TrioMision' },
  { nombre: 'Facebook', grupo: 'Trio Misión', icono: 'facebook', url: 'https://www.facebook.com/profile.php?id=61557572727740' },
  { nombre: 'TikTok', grupo: 'Trio Misión', icono: 'tiktok', url: 'https://www.tiktok.com/@trio_mision_bolivia' },
  { nombre: 'Spotify', grupo: 'Trio Misión', icono: 'spotify', url: 'https://open.spotify.com/intl-es/artist/3IJqAzw3YMvGBZ0MvXfVOC?si=F9mijbmeRkyYDXBeMzANpw' },
  { nombre: 'Facebook', grupo: 'Trio Misión Nueva Generación', icono: 'facebook', url: 'https://www.facebook.com/profile.php?id=100070773391476&locale=es_LA' },
  { nombre: 'TikTok', grupo: 'Trio Misión Nueva Generación', icono: 'tiktok', url: 'https://www.tiktok.com/@trio.mision.nueva' },
  { nombre: 'Apple Music', grupo: 'Catálogo musical', icono: 'apple-music', url: 'https://music.apple.com/us/album/solo-soy-un-peregrino/1750747192?uo=4' },
] as const

// Navegación del sitio del grupo: portada, historia y páginas de detalle.
export const navGrupo = [
  { href: '/#inicio', label: 'Inicio' },
  { href: '/historia', label: 'Historia' },
  { href: '/giras', label: 'Giras' },
  { href: '/#integrantes', label: 'Integrantes' },
  { href: '/#discografia', label: 'Discografía' },
  { href: '/#app', label: 'La App' },
  { href: '/#contacto', label: 'Contacto' },
] as const

// Navegación de la página de la app (dominio aparte, con vuelta al grupo)
export const navApp = [
  { href: '/app#caracteristicas', label: 'Características' },
  { href: '/app#planes', label: 'Planes' },
  { href: '/app#faq', label: 'FAQ' },
] as const

// Google Play — package de la app Triomisión
// TODO: URL pública de Play Store cuando esté publicada
export const playStoreUrl = '#' as const

// Portal del usuario (fase 2 — proyecto React aparte, subdominio).
// TODO: reemplazar base por el subdominio real (ej. https://tienda.dominio.com).
// Mientras no exista, los botones apuntan a '#'.
export const portal = {
  login: '#', // será {base}/cuenta
  comprar: '#', // será {base}/comprar
} as const

// Operador del ecosistema
export const operador = {
  nombre: 'Blakor Tech Solution',
  url: 'https://blakor.tech',
} as const
