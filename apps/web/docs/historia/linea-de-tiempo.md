---
title: Línea de tiempo de Trio Misión
summary: Hitos históricos estructurados para mostrar en una línea de tiempo interactiva.
source: historia-trio-mision-fuente-2018.doc
additional_sources:
  - biografia-trio-mision-nueva-generacion.docx
source_updated: 2026-08-09
status: transcripcion_editada_pendiente_validacion
---

# Línea de tiempo de Trio Misión

> Los hitos se extrajeron del documento histórico del grupo. Las fechas y los nombres deben validarse antes de publicarse. Los hitos sin año exacto se marcan como periodos. No se añadieron hechos externos.

## Datos para la interfaz

Cada hito usa `id`, `fecha`, `fecha_fin` (si aplica), `precision`, `categoria`, `titulo`, `resumen`, `lugar` y `personas`. `precision` puede ser `exacta`, `aproximada` o `periodo`. `categoria` permite filtrar la cronología.

```yaml
hitos:
  - id: origen-el-choro
    fecha: "1988"
    precision: aproximada
    categoria: origen
    titulo: Nace Trio Misión
    resumen: "El grupo comienza en El Choro, provincia de Caranavi, La Paz. La formación inicial mencionada incluye a Alcides Ávalos y Gabriel Quenallata."
    lugar: "El Choro, Caranavi, La Paz, Bolivia"
    personas: ["Alcides Ávalos", "Gabriel Quenallata"]
    validacion: "Confirmar año y formación fundadora; el documento dice 'alrededor de 1988'."

  - id: pausa-actividad
    fecha: "1989"
    fecha_fin: "1992"
    precision: periodo
    categoria: trayectoria
    titulo: Pausa de cuatro años
    resumen: "El grupo interrumpe su actividad por motivos de trabajo y estudio."
    lugar: null
    personas: []
    validacion: "Las fechas se infieren de la secuencia 1988/1993; confirmar."

  - id: retorno-la-paz
    fecha: "1993"
    precision: exacta
    categoria: trayectoria
    titulo: Retoman la actividad musical
    resumen: "Trio Misión retoma su actividad en la ciudad de La Paz."
    lugar: "La Paz, Bolivia"
    personas: []
    validacion: null

  - id: primera-grabacion
    fecha: "1994"
    precision: exacta
    categoria: grabacion
    titulo: Primera grabación
    resumen: "Se graban los primeros cánticos e himnos; Guildo Ávalos se suma para esta producción."
    lugar: null
    personas: ["Guildo Ávalos"]
    validacion: "Confirmar nombre y fecha de publicación de la grabación."

  - id: volumen-cinco
    fecha: "1996"
    precision: exacta
    categoria: integrantes
    titulo: Se incorpora Luis Hernán Colque
    resumen: "Luis Hernán Colque se integra para la grabación del quinto volumen."
    lugar: null
    personas: ["Luis Hernán Colque"]
    validacion: "Confirmar numeración del volumen."

  - id: primera-salida-peru
    fecha: "1996"
    precision: exacta
    categoria: presentacion
    titulo: Primera salida al exterior
    resumen: "El grupo realiza su primera salida internacional a Ilave."
    lugar: "Ilave, Perú"
    personas: []
    validacion: null

  - id: puno-juliaca
    fecha: "1997"
    precision: exacta
    categoria: presentacion
    titulo: Presentaciones en Puno y Juliaca
    resumen: "El documento registra un viaje a estas ciudades peruanas."
    lugar: "Puno y Juliaca, Perú"
    personas: []
    validacion: null

  - id: volumen-seis
    fecha: "1998"
    precision: exacta
    categoria: integrantes
    titulo: Se incorpora Juan Julio Apaza
    resumen: "Juan Julio Apaza se integra durante la etapa del sexto volumen."
    lugar: null
    personas: ["Juan Julio Apaza"]
    validacion: "Confirmar fecha y numeración del volumen."

  - id: gira-lago-titicaca
    fecha: "2000"
    precision: exacta
    categoria: presentacion
    titulo: Gira por el lago Titicaca
    resumen: "Realizan una gira de diez días por localidades peruanas a orillas del lago Titicaca."
    lugar: "Perú"
    personas: []
    validacion: null

  - id: incorporaciones-2004
    fecha: "2004"
    precision: exacta
    categoria: integrantes
    titulo: Se suman Eric Apaza y Edgar Romero
    resumen: "El documento registra la incorporación de ambos músicos."
    lugar: null
    personas: ["Eric Apaza", "Edgar Romero"]
    validacion: "Confirmar grafía de Eric/Erick y nombre completo."

  - id: cochabamba-2004
    fecha: "2004"
    precision: exacta
    categoria: presentacion
    titulo: Presentación en el Coliseo La Coronilla
    resumen: "Participan en una actividad organizada por la Misión Boliviana Central."
    lugar: "Cochabamba, Bolivia"
    personas: []
    validacion: "Confirmar nombre oficial de la actividad."

  - id: campana-la-paz
    fecha: "2005"
    precision: exacta
    categoria: presentacion
    titulo: Campaña en el estadio Hernando Siles
    resumen: "Participan en una campaña del Pr. Bullón."
    lugar: "La Paz, Bolivia"
    personas: []
    validacion: "Confirmar nombre y fecha de la campaña."

  - id: teatro-aire-libre
    fecha: "2006"
    precision: exacta
    categoria: presentacion
    titulo: Presentación transmitida por satélite
    resumen: "Actúan en el Teatro al Aire Libre durante una campaña del Pr. Bullón."
    lugar: "La Paz, Bolivia"
    personas: []
    validacion: "Confirmar nombre y fecha de la campaña."

  - id: trio-infantil
    fecha: "2007"
    precision: exacta
    categoria: grabacion
    titulo: Primer disco de Trio Misión Infantil
    resumen: "Graban un disco con sus hijos. El documento menciona a Gabriel, Pitter Kevin, Abdías y Gerson."
    lugar: null
    personas: ["Gabriel Quenallata (hijo)", "Pitter Kevin Quenallata", "Abdías Apaza", "Gerson Apaza"]
    validacion: "Confirmar nombre oficial del grupo y nombres/edades al momento de grabar."

  - id: espinar
    fecha: "2007"
    precision: exacta
    categoria: presentacion
    titulo: Viaje a Espinar
    resumen: "El grupo visita la ciudad de Espinar."
    lugar: "Espinar, Perú"
    personas: []
    validacion: null

  - id: segundo-disco-infantil
    fecha: "2008"
    precision: exacta
    categoria: grabacion
    titulo: Segundo disco infantil
    resumen: "Se graba el segundo disco de la formación infantil."
    lugar: null
    personas: []
    validacion: "Confirmar título del disco."

  - id: sao-paulo-2008
    fecha: "2008"
    precision: exacta
    categoria: presentacion
    titulo: Invitados a São Paulo
    resumen: "Viajan invitados por la Asociación Paulistana."
    lugar: "São Paulo, Brasil"
    personas: []
    validacion: "Confirmar nombre oficial de la asociación."

  - id: sao-paulo-2009
    fecha: "2009"
    precision: exacta
    categoria: presentacion
    titulo: Regreso a São Paulo
    resumen: "Viajan invitados por miembros de la comunidad hispana."
    lugar: "São Paulo, Brasil"
    personas: []
    validacion: null

  - id: miguel-apaza
    fecha: "2010"
    precision: exacta
    categoria: integrantes
    titulo: Se incorpora Miguel Apaza
    resumen: "Se integra como primera guitarra y voz."
    lugar: null
    personas: ["Miguel Apaza"]
    validacion: "Confirmar nombre completo."

  - id: gira-peru-2010
    fecha: "2010"
    precision: exacta
    categoria: presentacion
    titulo: Gira por el sur del Perú
    resumen: "Se presentan en Arequipa, Cusco, Puno y otras ciudades."
    lugar: "Perú"
    personas: []
    validacion: null

  - id: buenos-aires
    fecha: "2011"
    precision: exacta
    categoria: presentacion
    titulo: Presentación en Buenos Aires
    resumen: "El documento registra un viaje a la capital argentina."
    lugar: "Buenos Aires, Argentina"
    personas: []
    validacion: null

  - id: juliaca-2012
    fecha: "2012"
    precision: exacta
    categoria: presentacion
    titulo: Concierto en Juliaca
    resumen: "Realizan un concierto en la Iglesia de la avenida Australia."
    lugar: "Juliaca, Perú"
    personas: []
    validacion: "Confirmar nombre oficial de la iglesia."

  - id: fredy-casu
    fecha: "2013"
    precision: exacta
    categoria: integrantes
    titulo: Se incorpora Fredy Casu
    resumen: "Se suma como primera guitarra."
    lugar: null
    personas: ["Fredy Casu"]
    validacion: "Confirmar grafía y nombre completo (Fredy/Freddy)."

  - id: iglesias-puno-juliaca
    fecha: "2013"
    precision: exacta
    categoria: presentacion
    titulo: Visitan iglesias de Puno y Juliaca
    resumen: "El grupo realiza presentaciones en varias iglesias de ambas ciudades."
    lugar: "Puno y Juliaca, Perú"
    personas: []
    validacion: null

  - id: gabriel-hijo-guitarra
    fecha: "2014"
    precision: exacta
    categoria: integrantes
    titulo: Gabriel Quenallata (hijo) asume la primera guitarra
    resumen: "A los 16 años asume como primera guitarra de Trio Misión."
    lugar: null
    personas: ["Gabriel Quenallata (hijo)"]
    validacion: "Confirmar nombre completo y fecha."

  - id: jose-luis-condori
    fecha: "2014"
    precision: exacta
    categoria: integrantes
    titulo: Se incorpora José Luis Condori Echeverría
    resumen: "Se suma en tercera voz y guitarra."
    lugar: null
    personas: ["José Luis Condori Echeverría"]
    validacion: "Confirmar su relación temporal con las formaciones posteriores."

  - id: radios-carannavi
    fecha: "2014"
    precision: exacta
    categoria: presentacion
    titulo: Visita a Radio Luz del Tiempo
    resumen: "Actividad en Los Incas de Caranavi."
    lugar: "Caranavi, Bolivia"
    personas: []
    validacion: "Confirmar nombre de radio y localidad."

  - id: radio-nuevo-tiempo
    fecha: "2015"
    precision: exacta
    categoria: presentacion
    titulo: Visita a Radio Nuevo Tiempo Israel
    resumen: "Actividad en Caranavi."
    lugar: "Caranavi, Bolivia"
    personas: []
    validacion: "Confirmar nombre oficial de la radio."

  - id: campamento-santa-cruz
    fecha: "2016"
    precision: exacta
    categoria: presentacion
    titulo: Campamento de Grupos Pequeños
    resumen: "Participan en el campamento realizado en Santa Cruz."
    lugar: "Santa Cruz, Bolivia"
    personas: []
    validacion: null

  - id: campana-el-alto
    fecha: "2017"
    precision: exacta
    categoria: presentacion
    titulo: Campaña evangelística en El Alto
    resumen: "Participan en una campaña del Pr. Bullón."
    lugar: "El Alto, Bolivia"
    personas: []
    validacion: "Confirmar nombre oficial de la campaña."

  - id: iquique
    fecha: "2018"
    precision: exacta
    categoria: presentacion
    titulo: Presentación en la Iglesia Camiña
    resumen: "El documento registra una visita a esta iglesia."
    lugar: "Iquique, Chile"
    personas: []
    validacion: "Confirmar escritura del nombre de la iglesia y localidad."

  - id: migracion-santa-cruz
    fecha: "2019"
    precision: exacta
    categoria: trayectoria
    titulo: Gabriel Quenallata se traslada a Santa Cruz
    resumen: "Por motivos de salud, Gabriel Quenallata se traslada a Santa Cruz de la Sierra."
    lugar: "Santa Cruz de la Sierra, Bolivia"
    personas: ["Gabriel Quenallata"]
    validacion: "Confirmar redacción pública de este dato personal."

  - id: santa-cruz-formacion-2020
    fecha: "2020"
    fecha_fin: "2025"
    precision: periodo
    categoria: formacion
    titulo: Trio Misión continúa en Santa Cruz
    resumen: "El documento general registra a Gabriel Quenallata, Abraham Osco, Pitter Kevin Quenallata y Epraim Quenta en la formación de Santa Cruz; Justiniano Arojas aparece asociado a 2020–2022."
    lugar: "Santa Cruz de la Sierra, Bolivia"
    personas: ["Gabriel Quenallata", "Abraham Osco", "Pitter Kevin Quenallata", "Epraim Quenta", "Justiniano Arojas"]
    validacion: "Fuente: historia general. Confirmar periodo, roles y grafías."

  - id: nueva-generacion-iglesia-1ro-mayo
    fecha: "2021-03"
    precision: exacta
    categoria: formacion
    titulo: Comienza una nueva etapa del ministerio en La Paz
    resumen: "Arturo López, Josué Colque y Alexander Quenallata se reúnen en la Iglesia Adventista 1ro de Mayo para interpretar 'Todo tiene su tiempo'. Gabriel Quenallata los anima a continuar el ministerio y confía su continuidad a su hijo al trasladarse a Santa Cruz."
    lugar: "Iglesia Adventista del Séptimo Día 1ro de Mayo, La Paz, Bolivia"
    personas: ["Arturo López", "Josué Colque", "Alexander Quenallata", "Gabriel Quenallata"]
    validacion: "Fuente: biografía de esta etapa. La historia general menciona 2019; confirmar qué ocurrió en ese año."

  - id: viajes-peru-nueva-generacion
    fecha: "2021"
    fecha_fin: "2022"
    precision: periodo
    categoria: presentacion
    titulo: Primeros viajes por Perú
    resumen: "El trío visita con frecuencia Juliaca, Puno y Desaguadero para participar en actividades y compartir su música."
    lugar: "Perú"
    personas: ["Arturo López", "Josué Colque", "Alexander Quenallata"]
    validacion: "La fuente no indica fechas concretas para cada visita."

  - id: josue-descanso-juan-daniel
    fecha: "2023"
    precision: exacta
    categoria: integrantes
    titulo: Juan Daniel Condori se incorpora
    resumen: "Josué Colque toma un descanso de sus actividades y se incorpora Juan Daniel Condori, quien después pasa a ser el vocalista principal."
    lugar: null
    personas: ["Josué Colque", "Juan Daniel Condori"]
    validacion: "Confirmar fecha del cambio y roles actuales de los integrantes."

  - id: alto-azapa
    fecha: "2023-12"
    precision: exacta
    categoria: presentacion
    titulo: Viaje a Alto Azapa
    resumen: "El trío realiza un viaje internacional y comparte su ministerio en Alto Azapa."
    lugar: "Alto Azapa, Chile"
    personas: []
    validacion: "Confirmar localidad y fecha exacta."

  - id: cusco-2024
    fecha: "2024-08"
    precision: exacta
    categoria: presentacion
    titulo: Viaje a Cusco
    resumen: "El grupo visita Cusco."
    lugar: "Cusco, Perú"
    personas: []
    validacion: null

  - id: trujillo-2024
    fecha: "2024-09"
    precision: exacta
    categoria: presentacion
    titulo: Viaje a Trujillo
    resumen: "El grupo visita Trujillo."
    lugar: "Trujillo, Perú"
    personas: []
    validacion: null

  - id: cutervo-2025
    fecha: "2025"
    precision: exacta
    categoria: presentacion
    titulo: Viaje a Cutervo
    resumen: "Uno de los viajes destacados del año lleva al trío a Cutervo, Cajamarca; también realiza otros viajes por el Perú."
    lugar: "Cutervo, Cajamarca, Perú"
    personas: []
    validacion: "La fuente no especifica fecha o mes."

  - id: alexander-sale
    fecha: "2026-01"
    precision: exacta
    categoria: integrantes
    titulo: Cierra una etapa para Alexander Quenallata
    resumen: "Alexander Quenallata concluye su etapa como integrante, que comenzó con la fundación del trío en 2021."
    lugar: null
    personas: ["Alexander Quenallata"]
    validacion: "Confirmar formulación pública y situación actual de la agrupación."

  - id: discografia-2025
    fecha: "2025"
    precision: exacta
    categoria: grabacion
    titulo: Balance de grabaciones
    resumen: "El documento contabiliza 28 discos de Trio Misión, cuatro infantiles y juveniles y uno de las esposas; declara 34 en total."
    lugar: null
    personas: []
    validacion: "Las categorías suman 33, no 34. Confirmar el total y el periodo cubierto."
```

## Categorías sugeridas para filtros

- `origen`: inicio del grupo.
- `trayectoria`: pausas, retornos y cambios importantes.
- `integrantes`: incorporaciones y cambios de función.
- `grabacion`: producciones y discografía.
- `presentacion`: giras, conciertos, campañas y medios.
- `formacion`: generaciones y sedes.

## Criterios editoriales

- Mantener hitos con año y ubicación; indicar «año aproximado» cuando corresponda.
- Mostrar `validacion` en el documento editorial, no en la experiencia pública final.
- No convertir edades, roles ni fechas inferidas en afirmaciones hasta confirmarlas.
- Ordenar los hitos por fecha y, dentro del mismo año, por relevancia o categoría.
