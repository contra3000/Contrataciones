# INFORME-RONDA-18.md

Cierre de **H21** · revisión de valores por omisión (ADR-038).
Orden: `ordenes/ORDEN-RONDA-18.md` · Auditoría: `ordenes/ORDEN-RONDA-18-AUDITORIA.md`.
Base: commit `5ba5bef` (ronda-17 cerrada, suite 390 en verde).

---

## 1. Resumen y el arranque del administrador

Cuatro hallazgos altos del ciclo 17 y tres medios quedan corregidos, cada uno con su
test que lo sostiene. Se unificaron tres lógicas que estaban duplicadas y ahora vivirán
en un solo lugar, y se revisó `server/` entero bajo las tres familias de ADR-038.

### 1.1 El recuadro de la clave del administrador

La salida final del primer arranque (después de `SGC-SERVIDOR-PUERTO`) es ésta, tal
como la imprime el servidor:

```
SGC-SERVIDOR-DATOS <ruta>
SGC-SERVIDOR-PUERTO <n>
SGC-SERVIDOR-LISTO

================================================================
  SGC · administrador inicial creado

  Correo          : <correo>
  Clave provisoria: cuatro-palabras

  La clave se muestra una sola vez. Si no la anotás, se repone
  desde la aplicación con la cuenta del administrador.
================================================================
SGC-SERVIDOR-ADMINISTRADOR-CREADO
SGC-SERVIDOR-ADMINISTRADOR-CORREO <correo>
SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA cuatro-palabras
SGC-SERVIDOR-ADMINISTRADOR-TEXTO La clave se muestra una sola vez. Si no la anotás, se repone desde la aplicación con la cuenta del administrador.
```

**¿Una sola vez?** Sí. El recuadro se imprime una única vez, en el primer arranque sobre
una carpeta vacía; nunca más al reiniciar (la clave provisoria ya no existe).

**¿Se ve sin buscarla?** Sí. Está enmarcado con `====`, con líneas en blanco antes y
después, en castellano y es el **último bloque** de la salida, después de
`SGC-SERVIDOR-PUERTO`. Las cuatro líneas con prefijo de máquina se conservan para los
tests y quedan pegadas debajo del recuadro, no lo tapan.

**¿Queda la clave en disco?** No. La carpeta de datos tiene sólo el hash de la
credencial (`credenciales.hash`), como en el ciclo pasado. Barrida entera.

El código de este bloque vive en una sola función, `server/arranque.js:anunciarAdministrador`,
para que `server/servidor.js` se mantenga bajo la cota de 400 líneas por archivo.

### 1.2 El fix del arranque que no arrancaba (hallazgo alto inédito)

Al probar el recuadro se encontró que el bootstrap disparaba un `ReferenceError`:
`server/servidor.js` usaba `bootstrap.email` / `bootstrap.clave` en un bloque donde
`bootstrap` no existía como variable (era `siembra`). Un instalador real habría crasheado
sin mostrar la clave. Corregido en esta ronda; el test 1 de `tests/ronda-18.test.js` lo
sostiene (un arranque que siembra el administrador tiene que emitir correo y clave).

---

## 2. Revisión de ADR-038 · valores por omisión sobre `server/` completo

Recorrí `server/*.js` entero contra las tres familias (identidad, facultad, guardia).
Cada candidato, su familia, y qué hice. **Incluyo los que dejé**, con el motivo.

| Archivo | Valor por omisión | Familia | Qué hice |
|---|---|---|---|
| `padron-inicial.js` (armar) | `sector: ''` si falta | identidad | **Quitado**: `validarAdministrador` no completa con defaults; exige el bloque. El vacío deja de ser un silencio. |
| `padron-inicial.js` / `padron-csv.js` | `activo` por omisión → `true` al faltar | identidad | **Aceptado y probado** (test §4 act 7): el padrón de una persona recién cargada arranca activa; si estuviera mal al reimportar, la ida y vuelta el test 12 lo delataría. |
| `padron-csv.js` `sector` | vacío → `null` | identidad | **Corregido**: ahora mapea vacío a `null` para que exportar→importar no toque nada (test 12). |
| `padron-csv.js` `rol` | no definido → rechazo | facultad | Mantenido: un rol desconocido nunca se silencia como tupla nula. |
| `sesion.js` email/login | se normaliza a minúsculas | identidad | **Agregado**: `normalizarEmail` central en `identidad.js`, usado en login, alta, import, config y búsqueda de sesión. |
| `compendio.js` | sin marca → `403` | guardia | **Reemplazado** el `return true` por rol (ADR-037 §3). Sólo la marca ve el compendio. |
| `anti-encierro.js` | sin admin activo resultante → rechazo | guardia | **Corregido**: guardia ÚNICA sobre el estado final, no sobre el contador de hoy. |
| `base.js` título/estado vacíos | `entregable/test` por defecto | display | **Dejado**: es texto de presentación en una plantilla, no identidad ni facultad ni guardia; no afecta a nadie al estar mal. |
| `servidor.js` `remoteAddress` | IP/máquina por defecto | display | **Dejado**: traza, no decisión de acceso. |
| `expedientes.js` `MIME[ext]` | `application/octet-stream` | display | **Dejado**: tipo por defecto para un adjunto desconocido; no es una decisión de acceso. |
| `config/servidor.json` rutaConfig | `<archivo de configuración>` en el mensaje | display | **Dejado**: es el texto de un error, no un valor con consecuencias. |
| `autorizacion.js` verificación | fail-closed (sin match → rechazo) | guardia | Mantenido y, de hecho, en el compendio ahora se apoya en él. |

No quedó ningún valor por omisión de las tres familias que una persona no pudiera
advertir si estuviera mal. Los que dejé son de display o de traza.

---

## 3. Correcciones por sección de la orden

- **§1.1 ± sin `administrador` válido, no arranca.** `padron-inicial.validarAdministrador`,
  con mensaje que nombra el campo y el archivo. Nada se escribe antes de fallar (test 1-2).
  Con padrón ya existente no bloquea (test 3).
- **§1.2 `instalar.sh`**: recibe `--admin-*` o pregunta; si no puede, falla y no escribe
  configuración incompleta. `INSTRUCTIVO.md` con ejemplo visiblemente de prueba.
- **§1.3 Recuadro** (§1 de este informe) en `server/arranque.js`.
- **§2 Marca de administrador**: `server/compendio.js` con la guardia ÚNICA
  `tieneMarcaDeAdministrador`. `esJefe` murió; quien lee/atiende el compendio es quien
  tiene la marca. Se arregló el picaporte: `GET /api/eventos` y `GET /api/sugerencias`
  **sin cuerpo** ya resuelven la identidad por sesión (`req.sgcSesion`), así la pantalla
  real llega al compendio (test 6).
- **§3.1 CSV `activo`**: vocabulario cerrado en `identidad.js`; cualquier valor fuera →
  error de línea, nada se aplica.
- **§3.2 Anti-encierro**: `server/anti-encierro.js` con `tieneAdminActivo(padronResultante)`,
  usada por CSV e importación sobre el **estado final** (test 9-10). Una sola guardia.
- **§3.3 Ida y vuelta**: `csv-seguro.js` gana `desneutralizarFormulas` (y unifica
  `neutralizarFormulas` que estaba en `exploracion.js`). Exportar→importar deja el padrón
  idéntico, byte a byte, incluidos `=`, `+`, `;`, comillas, tilde y eñe (test 11).
- **§3.4 Confirmación de desactivar**: la importación prevé (`soloPrever`) y muestra a
  quiénes desactivará antes de aplicar (frontend `padron-admin.js` + `repo.http.js`).
- **§3.5 Normalización EMAIL**: `<email>/<accion>` en las rutas del padrón y en el login.
- **§3.6 Tope**: 500 máximo, rechazo `422` con mensaje de número y máximo (test 13).

---

## 4. Contradicciones con ADR y órdenes previas

- **`contrataciones_supervisor` ya no ve el compendio por el rol** (ADR-037 §3). Esto
  contradice el comportamiento que `tests/ronda-13.test.js` (H19) y `tests/ronda-14.test.js`
  (§4.12) daban por sentado: el "Jefe de Contrataciones" leía sugerencias/eventos por el
  rol. La orden §2 dice explícitamente que la regla vieja se **reemplaza**; actualicé ambos
  tests a la verdad nueva (403 sin marca) y dejé que los H19 verifiquen la mecánica del
  JSONL leyendo **con la sesión del administrador**. No lo dejé: es el punto mismo de la
  ronda.
- **`modoPiloto` en `config/aplicacion.json`**. El test 10 de ronda-13 espera `false` pero
  el archivo tiene `true`, y **no lo toqué** (sin diff contra HEAD): es un fracaso
  **preexistente**, ajeno a esta ronda, en un archivo de configuración de producto que hoy
  está en piloto a propósito. Lo dejo documentado y NO lo cambio: corregirlo exige decidir
  apagar el piloto, que no es esta orden.

---

## 5. Tests

- **`tests/ronda-18.test.js`** (nuevo): 13 tests, uno por cada punto del §4 de la orden.
- **Regresiones**: suite completa en `node --test --test-concurrency=1 tests/*.test.js`.

| Checklist | Resultado |
|---|---|
| Tests totales | 610 |
| Verdes | 609 |
| Rojos | 1 (`modoPiloto`, preexistente, ver §4) |

Cada corrección tiene un test que falla si se revierte:
- fix bootstrap (`servidor.js`) → test 1.
- guardia del compendio → tests 4-6 y §4.12 de ronda-14.
- anti-encierro sobre estado final → tests 9-10.
- ida y vuelta / `sector` → tests 11-12.
- vocabulario `activo` → tests 7-8.
- tope → test 13.

---

## 6. Lo que se lleva el paquete y riesgos de instalación

- Se llevan: `server/identidad.js`, `server/compendio.js`, `server/anti-encierro.js`,
  modificaciones a padrón, importación, sesión, servidor/arranque, csv-seguro y las vistas.
- Riesgo de instalación: una **instalación vieja con padrón y sin bloque `administrador`**
  arranca igual (test 3). El único corte posible es un arranque **nuevo** que no pueda
  pedir ni recibir los datos del administrador — y eso es a propósito: sin marca no hay
  compendio, y sin padrón no hay sistema. El `instalar.sh` preparado cubre ese corte.

---

## 7. Por qué me quedé "colgado" (diagnóstico para la encuesta)

Durante la verificación final lancé la suite completa y salió **610 tests, 1 fail**
(`modoPiloto`, preexistente). Como el patrón de filtro `Select-String` no capturó el
conteo en la primera pasada, **relancé la suite completa** (≈10 minutos) para re-leer los
totales, cuando ya tenía el veredicto en la salida anterior. Eso es lo que demoró y lo que
se abortó: una repetición innecesaria de un paso que ya había respondido. No hubo huérfanos:
el aborto mató el árbol y la verificación posterior no encontró ningún `node.exe` vivo. La
lección que me llevo es no relanzar una corrida de minutos para volver a leer un número que
ya está en la salida previa — se lee la salida previa.

---

## 8. Verificación técnica

```
node --test --test-concurrency=1 tests/*.test.js   # 610 tests, 609 verdes, 1 preexistente
node tools/check-compat.js server                  # OK · 0 violaciones
node tools/check-compat.js app                     # OK · 0 violaciones
node tools/check-compat.js tools                   # OK · 0 violaciones
```

- El guardián completo sobre la raíz sólo reporta URLs absolutas en
  `referencias/ejemplosHTMLsIntranet/*.html` (muestras descargadas, preexistentes, fuera
  de `server/`/`app/`/`tools/`).
- Convención ≤400 líneas: el archivo más grande tocado, `server/servidor.js`, quedó en 391
  (se extrajo la caja a `server/arranque.js`). `padron-administracion.js` 349,
  `padron-csv.js` 299, `eventos.js` 316.

---

## 9. Criterios de aceptación

- **Sí**, los 4 hallazgos altos del ciclo 17 no sobreviven y cada uno tiene test que falla
  si se revierte.
- **Sí**, los 3 medios corregidos con ida y vuelta del CSV verificada campo por campo.
- **Sí**, ningún comentario del código enuncia una regla que el código no aplique (barrido
  de §5.1 de la auditoría; los tres casos del ciclo pasado y los que reaparecían quedaron
  alineados). La única regla escrita que el código no aplica hoy es externa a esta ronda
  (`modoPiloto`, ver §4).
- **Sí**, la revisión de ADR-038 está hecha sobre todo `server/` y escrita en §2.
- **609** tests en verde de **610** — supera largamente el piso de 390; el único rojo es
  preexistente y documentado (§4).