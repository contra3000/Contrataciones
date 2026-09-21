# INFORME — RONDA 23

> **Informe parcial.** Las piezas 1 a 4 se entregaron en sus propios commits
> (`b69041c`, `9cbe906`, `8af77aa`, `9009446`, `8baf4ec`). Este archivo crece con
> cada pieza; la versión final, con las nueve secciones, se cierra en el commit
> `Ronda 23 · informe`.

---

## Pieza 5 · B2 — el barrido de los límites

Barrido de **sólo lectura** sobre `app/`, `server/`, `tools/` y `tests/`, para
responder una sola pregunta: **¿cada límite está declarado una vez, o repetido?**

Nada se corrigió en esta ronda: la lista es el insumo, y lo que se arregle sale de
acá y entra en la ronda 24, priorizado por el daño que hace la desincronización.

### Tamaños de cuerpo y de archivo

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Presupuesto: 20 MB | `app/js/core/limites.js` · `LIMITE_PRESUPUESTO_BYTES` | Servidor `server/presupuestos.js` (control y mensaje 413); cliente `app/js/views/requerimiento-presupuestos.js` (aviso previo y progreso); tests `tests/ronda-23-c4.test.js`, `tests/presupuestos-servidor.test.js` | **Sí.** Único (pieza 4). Antes estaba tres veces: `presupuestos.js:26`, `ayudantes.js:15` y `requerimiento-presupuestos.js:24`, más el texto del mensaje aparte. |
| Cuerpo general de la API: 4 MB | `server/ayudantes.js` · `LIMITE_CUERPO` | `leerCuerpo` (todas las rutas JSON) y su mensaje 413 | Único, sólo servidor. El cliente no lo conoce ni avisa antes; la vista de justificación corta a 20.000 por su cuenta. |
| Fragmento de catálogo: 280 KB | `tools/build-catalogo.js` · `LIMITE_FRAGMENTO` | sólo el build | **No.** `tests/build-catalogo.test.js` y `tools/medir-catalogo.js` usan **300 KB**. Preexistente. |
| Nombre original del presupuesto: 200 caracteres | `server/presupuestos.js` · `nombre.slice(0, 200)` | sólo servidor | Único; el cliente no recorta ni avisa. |
| Memoria de scrypt: 128 MB | `server/credenciales.js` · `PARAMETROS_SCRYPT.maxmem` | `scryptSync` (alta, login, reposición) | Único. |

### Cantidades máximas

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Códigos por llamada: 1000 | `server/manejadores.js` · `MAX_CODIGOS_POR_LLAMADA` | `apiValidarCodigos` | Único; el cliente no lo conoce ni avisa. |
| Filas de importación de padrón: 500 | `server/padron-csv.js` · `TOPE_IMPORTACION` | `importar` | Único; el cliente (`views/padron-admin.js`) no lo conoce ni avisa. |
| Sucesos del diálogo: 4000 | `server/sugerencias.js` · `TOPE_SUCESOS` | `crearSugerencia` y el estado (`completo`) | Único. |
| Sugerencias de catálogo: 8 · ítems: 60 | `app/js/catalogo/buscador.js` · `LIMITE_SUGERENCIAS`, `LIMITE_ITEMS` | sólo cliente | Único, sólo cliente. |
| Filas de la exploración: 200 | `app/js/views/exploracion.js` (comparación `> 200`) | sólo cliente | Único, sólo cliente. |
| Columnas del tablero: 10 | `app/js/views/tablero.js` (`Math.min(..., 10)`) | sólo cliente | Único, sólo cliente. |
| Ausentes listados: 10 (+ "resto") | `app/js/views/padron-admin.js` (`slice(0, 10)`) | sólo cliente | Único, sólo cliente. |
| Intentos fallidos de login: 10 | `server/sesion.js` · `MAX_FALLOS` | login y bloqueo | Único, sólo servidor. |

### Topes de caracteres

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Aclaración impresa: 256 | `app/js/core/config.js` · `MAX_ACLARACION` | `core/anexo-eett.js` (umbral del anexo), `catalogo/renglones.js`, `renders/requerimiento.js`; el servidor lo lee por `core/validacion` | Único. |
| Aclaración total: 2000 | `config.js` · `MAX_ACLARACION_TOTAL` | `core/validacion.js` (guard de entrada), `catalogo/renglones.js` (`aclaracion.maxLength`), `views/pasos.js`, `views/fasttrack.js`; servidor `server/expedientes.js` vía `validarRenglon` | Único. |
| Justificación: 20.000 | `config.js` · `MAX_JUSTIFICACION` | `core/validacion.js` (`validarFundamentacion`, `validarJustificaciones`); servidor en POST/PUT por la misma `validarJustificaciones` | Único. |
| Cotas del encabezado (120 / 40 / 80 / 10 / 500 / …) | `app/js/core/cotas-encabezado.js` · `CAMPOS_ENCABEZADO_COTAS` | `core/validacion.js` `validarEncabezado`, usado por cliente y servidor (`expedientes.js`) | Único. |
| Contenido de la sugerencia: 4000 | `server/sugerencias.js` · `MAX_CONTENIDO` **y** `app/js/views/sugerencias.js` (`area.maxLength = 4000`) | servidor (`crearSugerencia`) y cliente (el textarea) | **No.** Dos declaraciones con el mismo valor, y el mensaje del servidor repite el número literal (`'… hasta 4000 caracteres'`). Si cambia una, la otra queda. |
| Unidad de medida: 40 | `app/js/catalogo/renglones.js` (`unidad.maxLength = 40`) | sólo cliente | Único, pero **el servidor no lo verifica**: `validarRenglon` sólo exige que `unidad` no esté vacía. |
| Año: 4 dígitos | `app/index.html` (`maxlength="4"`), `core/validacion.js` (`/^\d{4}$/`) | cliente y servidor | Repetido, pero es formato (no un tope con número): no aplica "declarado una vez". |

### Tiempos de espera

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Sesión: 15 min | `server/sesion.js` · `TIEMPO_SESION_MS` | expiración de sesión | Único. |
| Demora por login fallido: 1000 ms | `server/sesion.js` · `DEMORA_FALLO_MS` | `demorarFallo` | Único. |
| Timeout del DNS inverso: 400 ms | `server/ayudantes.js` (`setTimeout(..., 400)`) | `resolverOrigen` | Único. |
| Lock de numeración: 20 reintentos × 10 ms | `server/ayudantes.js` (`adquirirLock(rutaLock, 20, 10)` en `siguienteNumero`) | `siguienteNumero` | Par de números pasado por llamada; hoy un solo llamador. |
| Aviso "copiado": 2000 ms | `app/js/views/padron-admin.js` (`setTimeout(..., 2000)`) | sólo cliente | Único. |
| Proceso `python` del pliego | **no hay** | `server/pliego-probador.js` · `ejecutarPython` (`spawn` sin `timeout`) | **Hallazgo.** Un `python` que se cuelga no resuelve nunca la promesa ni cierra el request. |

### Lo que la tabla deja a la vista

- **Un solo límite repetido con el mismo valor (y con el número copiado en un
  mensaje):** los 4000 de la sugerencia viven en `server/sugerencias.js` y en
  `app/js/views/sugerencias.js`.
- **Un límite con dos números:** el fragmento de catálogo: 280 KB (build) contra
  300 KB (test y medidor).
- **Un tope de entrada que el servidor no verifica:** la unidad de medida (40) en
  `catalogo/renglones.js`; `validarRenglon` no tiene cota para `unidad`.
- **Una espera sin techo:** el `spawn` del generador de pliego, sin `timeout`.
- El límite del presupuesto quedó **en un solo lugar** en la pieza 4; es el único
  de los topes grandes con control de servidor y aviso de cliente saliendo del
  mismo número.
