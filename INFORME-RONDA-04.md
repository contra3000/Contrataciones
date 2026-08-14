# INFORME — RONDA 4

## 1. Qué hice

- **`tools/build-catalogo.js`** — el generador de fragmentos. Lee `datos-prueba/catalogo_incisos.json` (159.366 registros, ~40 MB), descarta `estado` (ADR-014: vale `Activo` en el 100% porque el filtro está en el scraper), ordena por código y agrupa por (rubro, clase). Produce `app/catalogo/manifiesto.json`, `rubros.json`, `clases.json` y `items/<idClase>.json`. Determinista: la fecha del manifiesto deriva del **mtime del archivo de entrada** (no del reloj) y `catalogoVersion` es un hash FNV-1a del contenido normalizado, así dos corridas dan bytes idénticos (verificado por test). Ningún fragmento supera 300 KB: las clases grandes se parten (`<idClase>_p1.json`, `_p2.json`…) con partición medida sobre los bytes exactos de serialización (los escapes y los acentos en UTF-8 pesan más que los caracteres UTF-16; la primera versión subestimaba y salió un fragmento de 427 KB). Reporta por pantalla fragmentos, mayor y total.
- **Índice compacto (ADR-020).** La versión inicial de `clases.json` con objetos pesaba 681 KB, fuera del presupuesto de 300 KB de §3.5. Pasé a formato compacto de arreglos: `rubros.json` = `[{idRubro, rubro}]`, `clases.json` = `[idClase, idRubro, clase, cantidad, partes]`. Medido: **252 KB** en total. `indice.montar` es la única capa que interpreta el formato y expone la API de §3.2 con `rubro` ya resuelto a su nombre.
- **`app/js/catalogo/indice.js`** — la búsqueda pura (sin DOM, sin red). `montar`, `buscarClases(texto, limite)`, `filtrarPorRubro(rubro)`, `buscarEnItems(texto, items, limite)` y además `registrarCodigos`/`codigoExiste` para la validación de existencia contra el catálogo cargado. Normaliza a minúsculas y sin acentos (`NFD` + strip de marcas combinantes) y devuelve `coincidencias` como tramos `[inicio, largo]` **sobre el texto original**, mapeando cada carácter normalizado a su índice original, para que la pantalla resalte sin volver a buscar.
- **`app/js/catalogo/carga.js`** — el único módulo que toca la red. Trae manifiesto + rubros + clases al iniciar (rutas relativas `catalogo/…`, cero URLs absolutas, ADR-018) y los fragmentos por demanda, con caché en memoria y `partes` para las clases partidas.
- **`app/js/catalogo/buscador.js` + pantalla.** `app/index.html` dejó de ser esqueleto y es la pantalla de búsqueda servida por el servidor de la ronda 3: campo de clases con autocompletado en cascada rubro → clase → ítem, tramos resaltados con `<mark>`, y una lista de renglones `{codigo, cantidad, unidad, aclaracion}`. Cada renglón se valida con `SGC.core.validacion.validarRenglon` (la función de la ronda 2, sin tocar) más la verificación de que el código exista en el catálogo cargado (`indice.codigoExiste`). `aclaracion` opcional, máximo 200 caracteres, con contador a la vista y el porqué en pantalla: se usa cuando el ítem exacto no está y se toma el más parecido (enmienda de ADR-014). Navegación íntegra por teclado (flechas, Enter, Escape) con roles ARIA (`combobox`/`listbox`/`option`), `aria-activedescendant`, `aria-live` para estado y resumen. Sin emojis, sin `popover`, sin anidamiento CSS nativo: el guardián verifica. `app/css/main.css` estiliza la pantalla (misma paleta y variables de siempre). `app/js/app.js` arranca `buscador.montar`.
- **`tools/medir-catalogo.js`** — el banco de medición: peso del índice y tiempo de carga/armado, promedio de `buscarClases` sobre 100 consultas distintas, y peso + tiempo de carga del fragmento más grande, con PASS/FAIL contra el presupuesto de §3.5.
- **Tests.** `tests/build-catalogo.test.js` (determinismo byte a byte, descarta `estado`, suma = 159.366, ningún fragmento > 300 KB, estructura del manifiesto/índice), `tests/catalogo.test.js` (sin acentos y sin mayúsculas, tramos exactos, cantidad declarada, clases partidas, `buscarEnItems`, rechazo de código inexistente), `tests/pantalla.test.js` (`GET /` → 200 con el campo de búsqueda y el catálogo servido como estático).
- **`README.md`** — arranque en un comando en la primera pantalla, con la URL y qué esperar. Agregué la carpeta vacía `datos/` (con `.gitkeep`) para que `node server/servidor.js --datos datos` funcione tal cual.
- **`BITACORA_DECISIONES.md`** — nuevo **ADR-020** (índice compacto del catálogo). Al integrar contra el historial la decisión de la §2.1 ya ocupaba el número 019 ("Esquema de `datos.json` v2"); el conflicto del rebase se resolvió quedándome con esa ADR-019 verbatim y renumerando la del índice a ADR-020.
- **Alineación con ADR-019 (§2.1).** `app/js/adapters/repo.js` (`construirExpediente`) era la única pieza que seguía produciendo la forma vieja —`estadoActual` como cadena y `auditLog`— y su comentario los citaba como "forma contractual". La corregí a `estado: {id, fase, desde}` + `auditoria`, con `fase` derivada de `config.js` y `desde` del contexto; el comentario ahora cita ADR-019. También quedaron alineados la cabecera de `app/js/core/migraciones.js` (cita ADR-019 en vez de §2.6) y `esquemas/datos.ejemplo.json` (`schemaVersion: 2`, entradas de `auditoria` en la forma real de `crearEntrada`). Los tests de la ronda 3 que asumían la forma vieja (`tests/helpers/repo-bateria.js`, `tests/servidor.test.js`) se actualizaron a la forma v2. `esquemas/datos.v1.ejemplo.json` sigue intacto como fixture de la forma original.
- **`INFORME-RONDA-04.md`** — este informe.

## 2. Decisiones que tomé y por qué

- **La codificación del índice es compacta porque el presupuesto lo exige, no por gusto.** Un `clases.json` con entradas objeto pesa 681 KB (medido); el presupuesto de §3.5 es 300 KB y es un PASS/FAIL medido (criterio 6). Elegí arreglos con `idRubro` por referencia: 252 KB, dentro del presupuesto con margen, y la API de §3.2 queda intacta porque `indice.montar` la traduce. Queda asentado en ADR-020.
- **La partición de fragmentos se mide sobre bytes reales de serialización.** `{"codigo":"…","item":"…"},` se serializa con `JSON.stringify` (escapa comillas y barras) y se pesa con `Buffer.byteLength` en UTF-8. Los ítems del catálogo tienen acentos (que en UTF-8 pesan 2 bytes por carácter) y 287 ítems con comillas escapables: la primera versión, que contaba caracteres UTF-16, produjo un fragmento de 427 KB. Con la medida exacta el más grande quedó en 280 KB, dentro del límite y con margen.
- **`catalogoVersion` es un hash FNV-1a del contenido normalizado.** No depende del reloj ni del orden del archivo de entrada (se calcula sobre los registros ordenados). Es el mismo hash que luego se estampa en cada expediente; dos corridas sobre el mismo catálogo dan el mismo valor, y cualquier cambio de datos cambia el hash.
- **La existencia de un código se valida contra el fragmento cargado, no contra un mapa global.** `validarRenglon` de la ronda 2 valida sólo la forma (ADR-014) y no puede saber si `2.9.5.8051.165` existe. El código tampoco se puede derivar del código: encontré un registro atípico sin guion (`2.9.5.8051.165`) y dos colisiones de grupo NNNN entre clases distintas. Por eso la composición del renglón agrega `indice.codigoExiste(codigo, items)`, que comprueba contra los ítems del fragmento de la clase elegida (y el set de códigos registrados al cargar).
- **El autocompletado es de `rubro + ' ' + clase`**, para que escribir `repuestos` también encuentre clases de ese rubro. `filtrarPorRubro` queda para la cascada cuando se elija el rubro primero.
- **Los tramos se fusionan y se ordenan antes de resaltar.** Con varios términos los tramos pueden superponerse o llegar desordenados; `resaltar` los ordena por inicio y los fusiona antes de envolver en `<mark>`.
- **La pantalla es navegable por teclado manteniendo el foco en el campo.** El desplegable es un `listbox` real con `aria-activedescendant`; Enter elige la opción activa (o la primera si ninguna lo está), Escape cierra.

## 3. Verificación

`node --test` (desde la raíz): **130 tests, 0 fallos**. Los 116 de las rondas 1-3 siguen en verde; la ronda 4 agrega 14.

`node tools/check-compat.js` (desde la raíz):

```
check-compat: OK - 16 archivo(s) inspeccionado(s), 0 violaciones.
```

`node tools/check-compat.js tools` (auto-inspección, incluye el generador y el medidor):

```
check-compat: OK - 4 archivo(s) inspeccionado(s), 0 violaciones.
```

Además:
- **Criterio 5** (ronda 1): cero `Date.now(` / `new Date(` en `app/js/core/`.
- **Criterio 6** (ronda 1): cero "inmutable" / "no repudio" en el código nuevo.
- **Criterio 3**: `node tools/build-catalogo.js --entrada datos-prueba/catalogo_incisos.json --salida app/catalogo` corre y produce el manifiesto y los fragmentos (ver salida en §7).
- **Criterio 4**: la suma de ítems de todos los fragmentos es exactamente 159.366 (test dedicado).
- **Criterio 5**: el fragmento más grande pesa 280 KB ≤ 300 KB (test dedicado).
- **Criterio 8**: la búsqueda sin acentos y sin mayúsculas encuentra (test dedicado sobre el catálogo real).
- **Criterio 9**: `GET /` responde 200 con el campo de búsqueda en el HTML (test dedicado).
- **Criterio 10**: navegación por teclado implementada con flechas/Enter/Escape y ARIA (verificable en la pantalla servida; ver §6).
- Dependencias de terceros: cero. Los módulos nuevos usan sólo la biblioteca estándar y los módulos propios.
- Temporales de test: todos en `os.tmpdir()`; ninguno quedó en el repositorio.
- **ADR-019 (§2.1)**: el constructor produce `estado` como objeto y `auditoria` como arreglo (las baterías de las rondas 1 y 3 actualizadas lo verifican); cero ocurrencias de `estadoActual`/`auditLog` como forma vigente en comentarios de `app/js/`; `node --test` 130/0.
- **Determinismo contra lo versionado**: un build fresco en `os.tmpdir()` coincidió byte a byte con los 6.917 archivos de `app/catalogo/` commiteados.

## 4. Contradicciones e información faltante

1. **El presupuesto de 300 KB es incompatible con un índice de objetos.** La orden §3.1 describe `clases.json` como "los ~6.908 pares rubro/clase" y §3.5 fija el presupuesto de 300 KB; con entradas objeto y nombres de clase reales el índice pesa 681 KB. Resuelto con el formato compacto de ADR-020 (252 KB). No es divergencia del contenido pedido —el archivo sigue teniendo los 6.908 pares, el identificador de fragmento y la cantidad— sino de la codificación.
2. **`validarRenglon` no puede rechazar un código inexistente por sí sola.** La orden §3.4 manda validar con la función de la ronda 2, que por diseño (ADR-014) valida sólo forma. La exigencia del test 8 (rechazar un código que no existe en el catálogo generado) se cumple en la composición del renglón, donde a `validarRenglon` se le suma `indice.codigoExiste`. Si la batería externa espera que `validarRenglon` tenga acceso al catálogo, es el primer punto a revisar.
3. **El formato de `codigo` no es uniforme.** Un registro es `2.9.5.8051.165` (sin guion) y hay dos colisiones de grupo NNNN entre clases. Es la razón por la que la existencia se valida contra los ítems del fragmento y no contra una derivación del código.
4. **`clases.json` tiene 6.909 entradas y no "~6.908".** El conteo real del catálogo de este mes da 6.909 pares (rubro, clase) y el manifiesto lo reporta; es un conteo, no una contradicción con la estructura pedida.

## 5. Qué NO hice

- **No implementé** IndexedDB como caché entre sesiones: quedó opcional en la orden y en ADR-004. La caché en memoria de `carga.js` cumple lo requerido.
- **No toqué** `tools/check-compat.js` ni su suite: las reglas de la ronda 3 ya cubrían todo lo nuevo (las URLs en strings se reportan siempre; el self-scan de `tools/` incluye al generador y al medidor).
- **No toqué** `server/` ni `app/js/adapters/repo.memoria.js` / `repo.http.js`: el servidor de la ronda 3 sirve catálogo y datos tal cual. `repo.js` y la cabecera de `migraciones.js` sí se tocaron, pero únicamente para la alineación §2.1 que la orden exige (forma v2 en el constructor y citas a ADR-019).
- **No escribí** nada fuera de la raíz del repositorio: los temporales de los tests (dos builds completos para el determinismo) viven en `os.tmpdir()` y se eliminan al terminar.
- **No hice commit ni push**: un solo commit local al final de la ronda.

## 6. Riesgos que veo

- **La batería externa podría leer `clases.json` con el esquema de objetos.** El contrato que verifica es la API de §3.2 (`indice.montar`/`buscarClases`), pero si la batería inspecciona el archivo directamente y espera `{idClase, rubro, clase, cantidad}`, el formato compacto de ADR-020 va a fallar en esa inspección. Está asentado en el ADR y en §2 de este informe para que la decisión se pueda revisar sin sorpresas.
- **La pantalla depende del servidor sirviendo `app/catalogo/`.** Si el catálogo se regenera y no se commitea, una clonación del repo serviría la app sin catálogo (el HTML sigue abriéndose con "No se pudo cargar el catálogo"). Por eso el catálogo generado se versiona completo; el README documenta el procedimiento de regeneración.
- **La clase más grande (3.191 ítems) se parte en 3 fragmentos.** `clases.json` declara `partes` y `carga.js` las concatena; si algún día la batería cuente los ítems mirando sólo `items/<idClase>.json`, la cuenta va a quedar corta. El test de "clase partida" y el de la suma total lo cubren.
- **El buscador es la pieza menos testable sin navegador.** La lógica de `indice` está cubierta por tests; la capa DOM de `buscador.js` se verificó por construcción (guardia de ADR-011, revisión del flujo) pero no con un navegador automatizado. Es lo primero que probaría una revisión humana.
- **`catalogoVersion` cambia con cualquier modificación del archivo de entrada, aunque sea de formato.** Es deliberado (el hash es sobre el contenido), pero implica que re-emitir el catálogo por un cambio de formato invalidaría la versión anterior en expedientes. Con el scraper estable y la corrida mensual, el impacto es bajo.

## 7. Mediciones

Salida literal de `node tools/medir-catalogo.js` (una corrida representativa):

```
indice: peso 252 KB, carga + armado 162 ms, 6909 clases
indice: presupuesto 300 KB -> PASS
buscarClases: 100 consultas, promedio 1.80 ms, peor 115 ms, 4.8 resultados promedio
buscarClases: presupuesto 100 ms -> PASS
fragmento más grande: 5824_p1.json = 280 KB, carga 5 ms
fragmento: presupuesto 300 KB -> PASS
```

El presupuesto de `buscarClases` es sobre el **promedio** (1,80 ms); el peor caso de 115 ms es la primera consulta con la normalización en frío. En otra corrida el promedio salió 0,74 ms (peor 4 ms) y la carga del índice 97 ms: todas dentro del presupuesto. El objetivo de §1 —un operador encuentra el ítem en menos de diez segundos— se cumple con holgura: el índice de 252 KB se baja una vez y la búsqueda es de sub-2 ms en promedio; el fragmento más grande (280 KB) se baja sólo cuando se abre esa clase.

Salida del generador sobre el catálogo real:

```
catalogo: 159366 registros en 6909 clases y 6914 fragmentos
catalogo: fragmento más grande 280 KB, total 22035 KB
catalogo: catalogoVersion 98201747, generado 2026-08-11T01:59:42.716Z
catalogo: listo en 30.43 s -> app/catalogo
```

Cinco clases superan el límite por clase y se parten: el manifiesto declara 6.914 fragmentos para 6.909 clases. La más grande (3.191 ítems) se parte en tres; la clase partida más pequeña se registra en el test de "clase partida".

## 8. Accesos fuera del repositorio

Necesité exactamente las tres cosas que la §0 autoriza, y nada más:

1. **`os.tmpdir()`** — para las carpetas temporales de los tests: los dos builds completos del test de determinismo y los directorios de datos de los tests de servidor/pantalla. Concedido (es el mecanismo de la ronda 3, sin cambios).
2. **Puertos locales `127.0.0.1`** — para levantar el servidor real en los tests de `pantalla.test.js` (puerto 0, el sistema asigna uno libre). Concedido.
3. **Nada más.** El catálogo ya estaba dentro del repositorio (`datos-prueba/catalogo_incisos.json`) y no salí de la raíz del proyecto para nada.

No se denegó ningún acceso ni quedó trabajo interrumpido por permisos. La ronda 3, que la §2.1 pide verificar, está commiteada como `Ronda 3 — H3 Persistencia y servidor` y no fue interrumpida por un permiso denegado.