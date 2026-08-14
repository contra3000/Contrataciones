# ORDEN DE TRABAJO — RONDA 3

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H3 — Persistencia y servidor local**
Emitida: 2026-08-14

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`: jerarquía de precedencia documental, las contradicciones se reportan sin resolverlas por cuenta propia, y no hay nadie disponible durante la ejecución.

Esta es la ronda donde aparece la **concurrencia real**. Hasta ahora todo lo escrito era determinista y de un solo hilo. A partir de acá, dos operadores pueden guardar el mismo expediente en el mismo segundo, y el sistema tiene que comportarse de forma correcta y predecible cuando eso pasa. Es también la ronda donde el código deja de vivir sólo en el navegador.

---

## 1. Alcance

El adaptador de persistencia, el servidor mínimo que lo respalda, y las garantías de integridad que sólo pueden existir del lado del servidor.

**Fuera de alcance en esta ronda** (están planificados, no los adelantes): interfaz de usuario, catálogo de ítems, script de copia de respaldo, y la restricción de rol por máquina de ADR-017 medida 4 — esta última depende de un dato de infraestructura que todavía no se relevó.

---

## 2. Correcciones arrastradas de la ronda 2 (obligatorias)

Se hacen antes del trabajo nuevo. Si alguna ya está resuelta en tu repositorio, verificalo y dejalo asentado en el informe.

### 2.1 — Corrección a mi propia instrucción sobre falsos positivos

La orden de la ronda 2 §2.1 pedía que una violación escrita dentro de un literal de cadena no se reportara. **Esa regla estaba mal generalizada y la corrijo acá:**

- Para las **APIs vetadas** (`toSorted`, `Object.groupBy`, etc.): sigue valiendo. Dentro de un comentario o de una cadena, no se reportan.
- Para las **URLs absolutas** `http://` y `https://`: **se reportan siempre, también dentro de literales de cadena.** Una URL en código JavaScript está siempre dentro de una cadena; excluirlas desactiva la comprobación justo en el único caso que ocurre en la práctica, y con ella la protección del carácter air-gapped del sistema (ADR-018).

Ajustá tu guardián y tu suite adversaria en consecuencia.

### 2.2 — Cobertura del guardián

Verificá, con casos en tu suite, que tu guardián detecta: `<script type="module">` en HTML, el anidamiento CSS nativo con `&`, y el flag `v` en expresiones regulares. Corregí lo que falte.

### 2.3 — Archivos temporales de test

Los temporales de cualquier test se crean en `os.tmpdir()`, **nunca dentro del repositorio**. Si tu suite escribe en `tests/` o en cualquier subcarpeta del proyecto, cambialo: un test que ensucia el árbol de trabajo falla en cuanto corre sobre un sistema de archivos que no le permite borrar.

### 2.4 — El esquema de `datos.json` es contrato congelado

`InstruccionesCodigo.md` §6.1, más las correcciones autorizadas por `ORDEN-RONDA-01.md` §2.6, es el contrato. En particular: `estadoActual` es una **cadena**, y el registro de auditoría es el arreglo **`auditLog`**.

Si tu implementación se desvía de eso, tenés dos caminos: revertir a §6.1, o **justificarlo por escrito** en el informe explicando qué se gana. Lo que no es aceptable es la divergencia silenciosa: hay código que se va a escribir contra ese contrato y no puede adivinar tu variante.

---

## 3. Entregables nuevos

### 3.1 — `app/js/adapters/repo.js` — la interfaz

Define el contrato de persistencia de ADR-002 y el selector de implementación. Ninguna vista ni el núcleo de dominio pueden saber si detrás hay un servidor, memoria o un archivo.

```js
SGC.adapters.repo.usar(implementacion)   // inyecta la implementación activa
SGC.adapters.repo.listarIndice()                          // -> Promise<[entradaIndice]>
SGC.adapters.repo.leerExpediente(id)                      // -> Promise<{expediente, version}>
SGC.adapters.repo.crearExpediente(datosIniciales, ctx)    // -> Promise<{id, version, expediente}>
SGC.adapters.repo.guardarExpediente(id, expediente, versionEsperada, ctx)
//    -> Promise<{ok:true, version}> | Promise<{ok:false, conflicto:true, versionRemota}>
SGC.adapters.repo.listarArchivoHistorico(filtros)         // -> Promise<[...]>
SGC.adapters.repo.archivar(id, ctx)                       // -> Promise<{ok}>
SGC.adapters.repo.guardarEntregable(id, nombre, contenido, ctx) // -> Promise<{ruta}>
```

Un conflicto de versión **no es una excepción**: es un resultado esperado del negocio y se devuelve como valor. Reservá las excepciones para lo que de verdad es un fallo.

### 3.2 — `app/js/adapters/repo.memoria.js`

Implementación completa en memoria, para tests. Debe reproducir fielmente la semántica de conflicto: si `versionEsperada` no coincide, devuelve `{ok:false, conflicto:true, versionRemota}` sin escribir nada.

### 3.3 — `server/servidor.js` — el servidor

Node sobre `node:http` y `node:fs`, **sin una sola dependencia**. Arranque literal y obligatorio:

```
node server/servidor.js --datos <ruta> --puerto <numero>
```

`--puerto` por defecto 8123. `--datos` es obligatorio; si la ruta no existe o no es escribible, el servidor **no arranca** e imprime un mensaje claro en español explicando qué falta. Debe aceptar una ruta UNC (`\\servidor\recurso\...`) además de una ruta local.

Sirve los estáticos de `app/` en `/`, y expone esta API. Las rutas y los códigos son obligatorios y literales:

| Método y ruta | Cuerpo | Respuestas |
|---|---|---|
| `GET /api/salud` | — | `200 {ok, version, datos:"accesible"\|"inaccesible"}` |
| `GET /api/indice` | — | `200 [entradaIndice]` |
| `POST /api/expedientes` | `{datosIniciales, contexto}` | `201 {id, version, expediente}` |
| `GET /api/expedientes/:id` | — | `200 {expediente, version}` · `404` |
| `PUT /api/expedientes/:id` | `{expediente, versionEsperada, contexto}` | `200 {version}` · `409 {conflicto:true, versionRemota}` · `404` |

Reglas del servidor:

1. **Escritura atómica.** Se escribe a un temporal en el mismo directorio y se renombra sobre el destino. Nunca se trunca el archivo bueno antes de tener el nuevo completo.
2. **La verificación de versión ocurre en el servidor**, no en el cliente. Es el único punto donde puede ser atómica; en el cliente siempre es una carrera.
3. **La numeración de expedientes se serializa** (ADR-009). `POST /api/expedientes` bajo concurrencia no puede entregar dos veces el mismo número, nunca. Usá un archivo de bloqueo con creación exclusiva (`wx`) y reintento; documentá la estrategia en el código.
4. **Índice fragmentado** (ADR-005): al crear o guardar, se actualiza `idx/<id>.json`, un archivo de unos cientos de bytes. `GET /api/indice` se arma listando ese directorio. **No existe un `master_index.json` único.**
5. **Cada petición registra origen.** El servidor toma la dirección de red y el nombre de equipo del cliente y los guarda junto al `contexto` recibido (ADR-017 medida 3). Es el único dato de identidad que el operador no elige.
6. **Guardia de recorrido de rutas.** Un `:id` que contenga `..`, barras, o cualquier intento de salir del directorio de datos se rechaza con `400` y no toca el disco. El servidor **jamás** escribe fuera de `--datos`.
7. **Carpeta de datos inaccesible:** `GET /api/salud` lo informa, y toda escritura falla con un mensaje legible en español en lugar de una excepción cruda.

Estructura del directorio de datos:

```
<datos>/
├── contador.json                       (numeración, protegido por bloqueo)
├── idx/<id>.json                       (índice fragmentado)
└── <anio>/<numero>_Expediente/
    ├── datos.json
    └── hist/                           (snapshots fuera de datos.json)
```

### 3.4 — `app/js/adapters/repo.http.js`

Habla con el servidor. Traduce `409` a `{ok:false, conflicto:true, versionRemota}` — sin lanzar excepción. Los errores de red sí son excepciones, con mensaje en español.

### 3.5 — Tests

Conservando en verde todo lo de las rondas 1 y 2:

1. **`repo.memoria` y `repo.http` cumplen el mismo contrato.** Escribí la batería una sola vez y corrésela a las dos implementaciones. Si una pasa y la otra no, el contrato no está bien definido.
2. **Concurrencia de escritura:** 20 `PUT` simultáneos sobre el mismo expediente, todos con la misma `versionEsperada`. Exactamente **1** responde `200`; los otros **19** responden `409`. Al terminar, `datos.json` es JSON válido y contiene exactamente el contenido del ganador.
3. **Concurrencia de numeración:** 20 `POST /api/expedientes` simultáneos producen **20 identificadores distintos**, sin huecos duplicados. Es el test de ADR-009 y el más fácil de aprobar por accidente: corrélo al menos 10 veces seguidas antes de darlo por bueno.
4. **Atomicidad:** un guardado interrumpido no deja `datos.json` truncado ni ilegible. Simulá el corte como puedas y explicá el método en el informe.
5. **Recorrido de rutas:** `GET` y `PUT` sobre identificadores como `../../secreto` devuelven `400` y no crean ningún archivo fuera del directorio de datos.
6. **Arranque:** con `--datos` inexistente el servidor no arranca y explica por qué.
7. **Índice:** crear tres expedientes deja tres archivos en `idx/`, y `GET /api/indice` devuelve las tres entradas.

El punto 2 y el punto 3 son los que definen esta ronda. Un servidor que los aprueba es un servidor; uno que no, es un archivo de JavaScript.

### 3.6 — `INFORME-RONDA-03.md`

Las seis secciones de siempre, más:

```
## 7. Evidencia de concurrencia
Salida literal de los tests de concurrencia de §3.5 puntos 2 y 3, con los
conteos reales de 200 y 409, y el resultado de las 10 corridas del punto 3.
Si algún test es intermitente, decilo: un test de concurrencia que a veces
pasa es un test que falla.
```

---

## 4. Reglas de conducta

Las siete de `ORDEN-RONDA-01.md` §3, sin cambios. Dos recordatorios que en esta ronda pesan especialmente:

- **Nunca escribas fuera de la raíz del repositorio.** Ni archivos temporales, ni carpetas de prueba, ni datos de ejemplo. Todo lo que produzcas vive dentro del proyecto, salvo los temporales de test, que van a `os.tmpdir()`.
- **Commit local, sin push.** Un solo commit: `Ronda 3 — H3 Persistencia y servidor`.

---

## 5. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` | Todo en verde, incluidas las rondas 1 y 2 |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | Guardián: URL absoluta dentro de una cadena | **Se reporta** (§2.1) |
| 4 | Guardián: `type="module"`, anidamiento CSS, flag `v` | Los tres se detectan |
| 5 | `node server/servidor.js --datos <ruta> --puerto <n>` | Arranca y responde `GET /api/salud` |
| 6 | 20 `PUT` concurrentes | Exactamente 1×`200` y 19×`409` |
| 7 | 20 `POST` concurrentes, 10 corridas | 20 identificadores distintos, siempre |
| 8 | `PUT /api/expedientes/../../x` | `400`, sin tocar el disco |
| 9 | Dependencias de terceros | Cero |
| 10 | Temporales de test dentro del repositorio | Ninguno |
| 11 | `INFORME-RONDA-03.md` con sus 7 secciones | Completo |

Se va a correr además una **batería externa** que arranca tu servidor con la línea de comandos de §3.3 y ejercita la API con casos que no conocés. Por eso las rutas, los códigos y los argumentos son literales.

---

## 6. Qué se está evaluando

La corrección bajo concurrencia, que es donde el código deja de parecerse a lo que uno cree que hace. Y la disciplina de no escribir fuera de lo asignado.

Pesa, en este orden: (1) los dos tests de concurrencia, (2) violaciones de restricción y de alcance, (3) conformidad de la API con la batería externa, (4) que `repo.memoria` y `repo.http` cumplan el mismo contrato, (5) honestidad del informe —en particular admitir intermitencias—, (6) prolijidad.

Un test de concurrencia que pasa por casualidad es peor que uno que falla: el que falla se arregla, el que pasa por casualidad se descubre en producción con un expediente perdido.
