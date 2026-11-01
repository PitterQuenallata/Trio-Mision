# GuitarTuna v7.79.0 — Análisis REA de funciones de afinación y Smart Scroll

**Fecha:** 2026-10-22  
**Analista:** Kimi Code CLI + REA 6.7.0  
**Artefacto:** `projects/guitartuna/reference/GuitarTuna v7.79.0.apk`  
**SHA-256:** `9205f28bdf948ab52fcb2beb76a12ea35d87fdc58036097dfa906c4a5d5b32f2`  
**Package:** `com.ovelin.guitartuna`  
**Versión:** 7.79.0 (148897)

---

## 1. Arquitectura general observada

La app es un juego/app de **Unity 2022.3.29f1** compilado con **IL2CPP**. La lógica principal vive en:

- `lib/arm64-v8a/libil2cpp.so` (105 MB) — código C# compilado AOT.
- `assets/bin/Data/Managed/Metadata/global-metadata.dat` (15 MB) — nombres de tipos, métodos y strings de IL2CPP.
- `lib/arm64-v8a/libYousicianNative.so` (~? MB) — biblioteca nativa de procesamiento de audio.
- Java/Kotlin solo actúa como capa mínima de Android (`com.yousician.yousiciannative.GuitarTunaActivity`).

> **Limitación:** Ghidra 12.1.4 instalado no tiene el decompilador nativo `mac_arm_64/decompile`, por lo que no se obtuvo pseudocódigo de los binarios nativos. Todo el análisis es estático: strings exportados, símbolos de IL2CPP metadata y nombres de tipos/métodos.

---

## 2. Funciones de afinación

### 2.1 Capa de UI / C# (ensamblado `Tuna.Tuner.dll`)

Namespace raíz: `Tuna.Tuner`

| Componente | Clase / Namespace observado | Rol inferido |
|------------|----------------------------|--------------|
| Página del afinador | `Tuna.Tuner.Menu.TunerMenuPage` | Pantalla principal del tuner. |
| Afinador cromático | `Tuna.Tuner.Menu.ChromaticTunerView` | Vista de tuner cromático (sin cuerdas fijas). |
| Cabezal guiado | `Tuna.Tuner.Menu.Headstock.*` | Representación visual de clavijero: `HeadstockPegButton`, `GuidedTuningHeadstockPegButton`, `HeadstockStringPointer`, `TuningPeg`. |
| Aguja / historial | `Tuna.Tuner.Menu.HistoryGraph.*` | Gráfico de afinación: `GraphNeedle`, `GuidedTuningGraphNeedle`, `TunerHistoryGraph`, `NoteDisplay`. |
| Efectos visuales | `Tuna.Tuner.Menu.Effects.SparklingEffectView` | Efectos cuando la nota está afinada. |
| ViewModels | `Tuna.Tuner.Menu.ViewModel.*` | `TunerViewModel`, `TunerGraphViewModel`, `ChromaticTunerViewModel`, `GuidedTuningHeadstockPegButtonViewModel`, etc. |
| Modelo de dominio | `Tuna.Tuner.Model.*` | `TunerSession`, `TunerConfiguration`, `SingleStringDetection`, `AllStringsTunedTrigger`, `TunerUserInteractionProvider`. |
| Analytics | `Tuna.Tuner.Analytics.*` | `TunedOneStringEvent`, `TunedAllStringsEvent`, `SwitchedTuningEvent`. |

Observaciones:
- Hay dos modos de afinación: **cromático** (`ChromaticTunerView`) y **guiado por cuerda** (`GuidedTuningHeadstock*`, `GuidedTuningGraphNeedle`).
- `TunerSession.State` y `TunerSessionData` manejan el ciclo de vida de una sesión de afinación.
- `SingleStringDetection` parece ser la unidad de detección para una cuerda individual.

### 2.2 Capa de audio nativa (`libYousicianNative.so`)

La señal de micrófono parece procesarse en C/C++ a través de la biblioteca `libYousicianNative.so`. Se identificaron las siguientes familias de funciones exportadas:

#### Pitch tracker

```
PitchTracker_Init
PitchTracker_Destroy
PitchTracker_ProcessNewFrame
PitchTracker_GetLatestPitchValue
PitchTracker_GetBacktrackedPitchCurveInLatestFrames
PitchTracker_GetNumBacktrackingFrames
PitchTracker_SetFunnelPriorParameters
```

- `ProcessNewFrame` indica que el algoritmo trabaja **frame a frame** desde el micrófono.
- `GetBacktrackedPitchCurveInLatestFrames` y `SetFunnelPriorParameters` sugieren un estimador de pitch con **backtracking** y **prior/funnel** para estabilizar la lectura (evita saltos erráticos entre notas cercanas).

#### Detección de notas por DNN

**Instrumentos de trastes (guitarra, ukelele, etc.):**

```
FrettedDnnInit
FrettedDnnDestroy
FrettedDnnLoadModels
FrettedDnnDetectNotes
FrettedDnnEvaluateAndGetDecision
FrettedDnnGetWasPlayedLevel
FrettedDnnGetOnsetFrame
FrettedDnnGetNoteVector
FrettedDnnGetOnsetVector
```

**Piano:**

```
PianoDnnInit
PianoDnnDestroy
PianoDnnLoadModels
PianoDnnDetectNotes
PianoDnnEvaluateAndGetDecision
PianoDnnGetWasPlayedLevel
PianoDnnGetOnsetFrame
PianoDnnGetNoteVector
PianoDnnGetOnsetVector
```

- Hay modelos de red neuronal **separados** para instrumentos de trastes y piano.
- Cada modelo devuelve vectores de nota (`GetNoteVector`) y de onset (`GetOnsetVector`), más un nivel de "fue tocado" (`GetWasPlayedLevel`).
- `DnnOnsetEstimatorInit/Destroy/ProcessFrame/FeedWeights/GetResult` es un estimador adicional de **onsets** (ataques/ inicio de notas) usado probablemente para evaluación de ejercicios.

#### Saliencia y espectro

```
SalienceInit / SalienceDestroy
SalienceCalculateSpectrum
SalienceCalculate
SalienceCalculateFromSpectrum
SalienceGetCriticalBandPowers
SalienceGetCriticalBandCompressedLevels
SalienceGetLoudnessEstimate
SalienceSetWindowFunction
SalienceSpectrumBufferSize
SalienceFFTSize
SalienceSpectralPeakRemove

SalienceBoosterInit / SalienceBoosterInitWithNotes
SalienceBoosterDestroy
SalienceBoosterApplyBoostToSaliences
SalienceBoosterApplyBoostToNoteSaliences
SalienceBoosterGetBoostForSalienceBin
SalienceBoosterGetBoostForMidiNote
SalienceBoosterGetBoostForNoteBin
SalienceBoosterCalculateBoostFactorForPitch
SalienceBoosterGetAffectedPitchLimit

SalienceNoiseFloorInit / SalienceNoiseFloorDestroy
SalienceNoiseFloorUpdateSalienceNoiseFloor
SalienceNoiseFloorGetNoiseFloorEstimate
```

- El pipeline de audio calcula un **espectro de saliencia** (probabilidad por bin/MIDI note).
- `SalienceBooster` permite **resaltar notas esperadas** (por ejemplo, las cuerdas abiertas del afinador o las notas de un ejercicio), lo que mejora la detección en contexto.
- `SalienceNoiseFloor` estima el piso de ruido para adaptar umbrales.

#### Síntesis / feedback de audio

```
PlayerSynthNoteOn / PlayerSynthNoteOff
SynthPlayMidiNote / SynthPitchBend / SynthNoteOn / SynthNoteOff / SynthAllNotesOff
```

- El afinador puede generar audio de referencia (tono de afinación) con un sintetizador interno.

---

## 3. "Mientras se canta baja la letra" — Smart Scroll

La feature que hace scroll automático de la partitura/letra mientras el usuario toca/canta se llama **Smart Scroll**. Tiene su propio ensamblado:

- `Tuna.SmartScroll.dll`
- Ruta de fuentes en el proyecto Unity: `Assets/SmartScroll/`

### 3.1 Clases principales

| Clase | Rol inferido |
|-------|--------------|
| `Tuna.SmartScroll.SmartScrollPlayPositionEstimator` | Estima en qué parte de la canción va el usuario, probablemente combinando audio del micrófono con el tempo/beat. |
| `Tuna.SmartScroll.IdentifiedChordsCounter` | Cuenta acordes reconocidos para calibrar o avanzar la posición. |
| `Tuna.SmartScroll.TunaSpectrumOverlay` / `TunaSpectrumOverlayBridge` | Visualización de espectro/audio asociada al scroll. |
| `Tuna.SmartScroll.Data.ModelWeightProvider` / `IModelWeightProvider` | Pesos del modelo que decide cuándo y cuánto avanzar. |

### 3.2 Eventos del sistema

```
SmartScrollAudioDetectedEvent
SmartScrollFirstMovementEvent
SmartScrollJumpEvent
SmartScrollPitchedSoundsDetectedEvent
SmartScrollToggleEvent
```

- Smart Scroll se activa/desactiva con eventos.
- Detecta **primer movimiento**, **sonidos con pitch** y **audio general** para empezar a hacer scroll.
- `SmartScrollJumpEvent` sugiere que puede hacer saltos cuando la posición estimada difiere mucho de la esperada.

### 3.3 UI / ViewModel

```
Tuna.Songs.Play.Menu.SwitchableSmartScrollView
Tuna.Songs.Play.Menu.SmartScrollSwitchStateHandler
Tuna.Songs.Play.Menu.SmartScrollTurnOffConfirmationPopupHandler
Tuna.Songs.Play.ViewModel.ISongSmartScrollViewModel
Tuna.Songs.Play.ViewModel.SwitchableSmartScrollViewModel
```

- Hay una vista conmutable (toggle) para activar/desactivar Smart Scroll.
- Al desactivarlo muestra un popup de confirmación con el texto:  
  *"If you turn off Smart Scroll, you'll need to manually scroll the song."*
- Strings relacionados:
  - `"Go your own pace with Smart Scroll"`
  - `"Continue with Smart Scroll"`
  - `"Turn off Smart Scroll?"`
  - `"ll scroll as you play!"`
  - `"Subscribe for {0}% off to access Smart Scroll & more"` (es una feature de pago).

### 3.4 Estado / campos observados

```
IsSmartScrollPaused
SmartScrollEnabled
smartScrollState
lineHighlightingSwitch
lineHighlightRowCanvasGroup
smartScrollRowCanvasGroup
WasLineHighlightActiveWhenSmartScrollClosed
OnUserScrollingStarted in frame: {0}
```

- Smart Scroll puede estar **pausado**, **habilitado** o **desactivado**.
- Existe **resaltado de línea activa** (`lineHighlightingSwitch`, `lineHighlightRowCanvasGroup`), lo que explica el efecto de "bajar la letra": la línea actual se resalta mientras el contenido hace scroll.
- Detecta cuando el usuario interactúa manualmente con el scroll (`OnUserScrollingStarted`).

---

## 4. Datos de canción y letra

El ensamblado `Tuna.Learn.SongData.dll` contiene:

- `Tuna.Learn.SongData.Lyric`
- `Tuna.Learn.SongData.Strum`

Smart Scroll opera sobre estos datos de letra/acordes. Además se observaron:

- `VocalTrack`, `Vocal_Track.ogg`, `IsVocalTrackEnabled`, `VoiceEvaluator` — existe una pista de voz y evaluación vocal.
- `Play with vocals on the backing track.`

---

## 5. Limitaciones y trabajo pendiente

1. **No se obtuvo pseudocódigo** de `libil2cpp.so` ni `libYousicianNative.so` porque Ghidra no tiene el decompilador nativo ARM64 en este entorno.
2. **No se ejecutó la app**; todo es análisis estático de strings y símbolos.
3. **No se extrajeron los modelos DNN** ni se inspeccionaron pesos/activaciones.
4. **No se hizo ingeniería inversa funcional** de los algoritmos de pitch/saliencia; solo se identificaron sus nombres y fronteras.
5. Para un análisis más profundo sería necesario:
   - Proporcionar el binario `decompile` de Ghidra para ARM64.
   - O usar Il2CppDumper/Il2CppInspector para reconstruir la estructura de clases C#.
   - O hacer un análisis dinámico con Frida/ADB en un dispositivo de prueba.

---

## 6. Conclusiones para Trio Misión

- **Afinador:** GuitarTuna separa claramente la UI (ViewModels en `Tuna.Tuner`), el dominio (`Tuna.Tuner.Model`) y el procesamiento de audio nativo (`libYousicianNative`). El pipeline de audio usa pitch tracker + DNN por familia de instrumentos + saliencia boost. Esto es un patrón replicable.
- **Smart Scroll:** La feature de scroll automático es un módulo independiente (`Tuna.SmartScroll`) que estima la posición de reproducción a partir de eventos de audio (movimiento, pitch, acordes) y sincroniza la UI de letra/partitura con resaltado de línea. Es funcionalmente equivalente a un "karaoke scroll" o "auto-scroll inteligente".
- **Monetización:** Smart Scroll está detrás de un paywall (strings de suscripción), mientras que el afinador base parece gratuito con limitaciones (tunings/tools de pago).

---

## 7. Evidencia REA

- `ev_9818ac5810bced4c2604f81eb0ea31a0f2c77132fdb0d13521b27d19be3670bb` — `inspect_android_package` (overview del APK).
- `ev_03856fdc8e4c1f9157282f8ee1aaa8b0bdabbf77efde6eb0b37e3881c2dd39a3` — `inspect_android_class` de `com.yousician.yousiciannative.GuitarTunaActivity`.
- Archivos locales de strings extraídos:
  - `/tmp/gt_metadata_strings.txt` — strings de `global-metadata.dat`.
  - `/tmp/gt_il2cpp_strings.txt` — strings de `libil2cpp.so`.
  - `/tmp/gt_smartscroll.txt`, `/tmp/gt_pitchtracker.txt`, `/tmp/gt_salience.txt`, `/tmp/gt_tuner.txt`, `/tmp/gt_lyrics.txt` — filtros temáticos.

---

*Reporte generado con REA 6.7.0 (JADX headless 0.7.1). Análisis estático; no se ejecutó el binario.*
