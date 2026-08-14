# INFORME — RONDA 2

## 1. Qué hice

- **Corrección §2.1 — Suite adversaria del guardián** (`tests/check-compat.test.js`): 34 casos que generan archivos temporales con cada ítem de la lista de veto (JS, CSS y HTML; `http://` y `https://`; `import`, `export` y `<script type="module">`; flag `v`), corren el guardián con límite de tiempo explícito de 5 s sobre archivos de menos de 50 líneas, y verifican también los falsos positivos (violación en comentario o en literal de cadena que no debe reportarse). Los temporales se crean y eliminan dentro de la suite.
- **Corrección §2.2 — Entregables de ronda 1**: todos presentes (verificados); no faltó ninguno.
- **Corrección §2.3 — Reconciliación de roles**: adopté los identificadores de `InstruccionesCodigo.md` §10.1 (`generador`, `abastecimiento`, `abastecimiento_supervisor`, `contrataciones`, `contrataciones_supervisor`, `juridica`, `contaduria`) y actualicé todo lo que los referenciaba.
- **Núcleo de dominio** (todos bajo `app/js/core/`, patrón IIFE, `'use strict'`, sin `Date.now(`/`new Date(`, sin dependencias del navegador):
  - `utils.js` — `idEstadoActual(expediente)` que soporta los dos formatos (`estado.id` v2 y `estadoActual` v1).
  - `auditoria.js` — `hash` (FNV-1a de 32 bits, determinista), `crearEntrada(entradaPrevia, datos)` y `verificarCadena(auditLog)` (cadena de hash encadenado, ADR-006).
  - `validacion.js` — `validarParaAvanzar(expediente)` (deriva exigencias del estado actual; correcta con arreglos vacíos y poblados) y `validarRenglon(renglon)` (enmienda ADR-014, sólo forma).
  - `estados.js` — motor de transiciones: `obtener`, `puedeAvanzar`, `avanzar`, `puedeDevolver`, `devolver`. Funciones puras; el instante llega en `contexto.timestamp`; la identidad es el correo (ADR-017); toda transición exitosa agrega una entrada de auditoría.
  - `migraciones.js` — `VERSION_ACTUAL` (2) y `migrar(documento)`; migración v1 → v2 que nunca descarta datos.
- **`esquemas/datos.v1.ejemplo.json`** — un expediente en el formato original de `InstruccionesCodigo.md` §6.1 para que el test de migración lo consuma.
- **Tests de la ronda 2**: `tests/auditoria.test.js`, `tests/validacion.test.js`, `tests/motor.test.js`, `tests/migraciones.test.js`, más la suite adversaria `tests/check-compat.test.js`. Los tests de ronda 1 quedaron intactos y en verde.
- **`INFORME-RONDA-02.md`** — este informe.

## 2. Decisiones que tomé y por qué

- **Adoptar los roles de §10.1.** `InstruccionesCodigo.md` está restaurado y §10.1 sigue vigente; además la orden (§3.1) da un ejemplo de contexto con `rol: 'contrataciones'`, que coincide con la nomenclatura de §10.1 y no con la de ronda 1 (`gestor_contrataciones`). Reemplacé los identificadores en `config.js` (ROLES y los 18 `rolEjecutor`) y en `config/usuarios.ejemplo.json`; los tests de ronda 1 siguen pasando porque no fijan ids de rol.
- **El guardián ya no marca URLs dentro de literales de cadena.** La orden §2.1 exige que una violación dentro de un string no se reporte. En ronda 1 el guardián corría la comprobación de URLs con las cadenas conservadas para capturar `fetch('https://...')` o `src="https://..."`; eso contradice la regla nueva. La URL se detecta ahora sobre el código limpio (sin cadenas ni comentarios). Esto deja afuera las URLs "declaradas" en strings, que es exactamente lo que pide la regla.
- **`puedeAvanzar`/`puedeDevolver` devuelven `destinos: []` cuando no hay permiso.** Interpreté que `destinos` son las opciones accionables para el llamador; si el rol no puede operar el estado, no hay opciones. Cuando hay permiso, son `estadosSiguientes`/`estadosDevolucion`. El estado terminal devuelve `permitido: true` (el rol correcto puede operarlo) con `destinos: []`, y `avanzar` sobre él falla porque no tiene siguientes.
- **`estadosDevolucion`**: mantengo la interpretación de ronda 1 — "estados a los que este estado puede devolverse" (el inmediato anterior de la cadena).
- **Semántica de `verificarCadena`**: devuelve el índice de la primera entrada cuya cadena no cierra — es decir, la primera entrada cuyo `hashPrevio` no coincide con el hash de la anterior (la primera debe tener `hashPrevio: null`). Una entrada 0 con `hashPrevio` no nulo rompe en 0. Nota: alterar la entrada k se detecta en k+1, y alterar la última no se detecta (no tiene sucesor que la referencie); es la limitación natural de una cadena sin hash raíz, coherente con el alcance de ADR-006.
- **Migración v1 → v2**: preserva todos los campos originales (clave por clave) y agrega `id`, `solicitante`, `catalogoVersion` (null), `renglones` (desde `incisos`, con `aclaracion: ''`), `estado` (objeto con fase derivada de config), `fechaLimite` (desde `sla`), `auditoria` (copia de `auditLog`) y `actualizado`. Un guardián estructural (`!Array.isArray(renglones)`) evita re-migrar documentos que ya tienen la forma v2 aunque su etiqueta `schemaVersion` sea ambigua (ver §4.1).
- **La cadena de auditoría del motor se anexa al arreglo existente** (`auditoria`, o `auditLog` si existe, o se crea `auditoria`), para no depender del nombre del arreglo del esquema de entrada.

## 3. Verificación

`node --test` (desde la raíz): **75 tests, 0 fallos**. Los 10 de ronda 1 siguen en verde (config y estados), más los 34 de la suite adversaria, más los de motor, auditoría, validación y migraciones.

`node tools/check-compat.js` (desde la raíz):

```
check-compat: OK - 9 archivo(s) inspeccionado(s), 0 violaciones.
```

`node tools/check-compat.js tools` (auto-inspección):

```
check-compat: OK - 2 archivo(s) inspeccionado(s), 0 violaciones.
```

Además:
- Criterio 5: cero `Date.now(` / `new Date(` en `app/js/core/`.
- Criterio 6: cero "inmutable" / "no repudio" en el código.
- Criterio 7 (pureza): verificado por `tests/motor.test.js` §5.
- Documentación y `tools/scraper-catalogo/` sin modificar.
- La suite adversaria demuestra que el guardián detecta las tres familias, no reporta los falsos positivos y responde en menos de 5 s por caso.

## 4. Contradicciones e información faltante

1. **Etiqueta `schemaVersion` ambigua.** El esquema de ronda 1 (`esquemas/datos.ejemplo.json`) usa `"schemaVersion": "1.0.0"` (string), mientras que la migración de esta ronda y `InstruccionesCodigo.md` §6.1 usan números (`1`, y el resultado `2`). No resolví la inconsistencia por mi cuenta: el guardián estructural de la migración evita tocar un documento que ya tiene `renglones`, y lo asiento acá para que se normalice la convención.
2. **`camposRequeridos` / `entregablesObligatorios` siguen vacíos** en los 18 estados (nada las puebla en la ronda 2, por orden). `validarParaAvanzar` quedó preparada para ambos casos y se testea con arreglos poblados mediante reemplazo temporal de configuración.
3. **Asignación gestor/supervisor por estado y `estadosDevolucion`**: siguen siendo propuesta (ver INFORME ronda 1 §4.2 y §4.4); §10.1 define los roles pero no el mapeo por estado.

## 5. Qué NO hice

- **No escribí** servidor, interfaz, catálogo, vistas, renders ni adaptadores de persistencia: la orden §1 los prohíbe.
- **No pueblé** `camposRequeridos` ni `entregablesObligatorios` por mi cuenta.
- **No modifiqué** la documentación ni `tools/scraper-catalogo/`.
- **No borré ni modifiqué** `INFORME.md` de la ronda 1.
- **No toqué** el código de ronda 1 fuera de lo que la orden pide: `config.js` (sólo por §2.3) y el guardián (sólo por §2.1).

## 6. Riesgos que veo

- **Alcance del hash de auditoría**: no criptográfico y sin hash raíz; la edición casual de la última entrada no se detecta. Documentado en el código y en §2; si el sistema evoluciona hacia una garantía más fuerte (escritura append-only del lado del servidor, ADR-015/ADR-006) hay que revisar este punto.
- **`puedeAvanzar` no valida los requisitos de §3.2**: el permiso se decide por rol y estado; la validación de completitud ocurre en `avanzar`. Si la UI quiere bloquear el botón antes de avanzar, habrá que decidir si `puedeAvanzar` incorpora la validación o si se llama a `validarParaAvanzar` por separado.
- **Roles de §10.1 y la batería externa**: asumo que la batería ejercita los identificadores nuevos; si la orden exigía mantener los viejos, la reconciliación queda documentada en §2 para revertirla sin ambigüedad.
- **El guardián ignora `//` como comentario en CSS** (no lo es) y en HTML fuera de `<script>`: si en el futuro la app usa inline scripts con comentarios `//`, conviene darles tratamiento de script dentro del lexer.

## 7. Autoauditoría del guardián

La suite adversaria de §2.1 **encontró defectos reales** en `tools/check-compat.js`. Lo que pasó, en orden:

1. **Las URLs dentro de literales de cadena se marcaban como violación.** La comprobación de URLs corría sobre `conCadenas` (texto con cadenas conservadas), así que `fetch('https://...')`, `href="https://..."` o `url("https://...")` se reportaban. La orden §2.1 exige que una violación dentro de un string **no** se reporte. **Causa técnica:** el texto sobre el que se corre la comprobación era el equivocado para la regla nueva. **Cambio:** la comprobación de URLs corre ahora sobre `sinCadenas` (código limpio).
2. **`<script type="module">` no se detectaba.** El patrón corría sobre `sinCadenas`, pero el valor del atributo `"module"` va entre comillas y el lexer lo recorta como cadena, así que el patrón nunca matcheaba. **Causa técnica:** la familia HTML se verificaba con el mismo texto "sin cadenas" que JS/CSS, donde los atributos quedan desdibujados. **Cambio:** `type="module"` se verifica en HTML sobre `conCadenas` (los atributos son sintaxis HTML, no literales de código), mientras que `import`/`export` se verifican sobre el código limpio.
3. **Las URLs de CSS sin comillas no se detectaban.** Al mover la comprobación a `sinCadenas`, el caso positivo `@import url(https://...)` no se detectaba. **Causa técnica:** el lexer trataba `//` como comentario de línea incluso en CSS, donde `//` no es comentario; recortaba `url(https:` dejando `url(https:   )` y la URL desaparecía antes de llegar al patrón. **Cambio:** el comentario de línea `//` se reconoce sólo en JS. En CSS, `//` pasa como código y la URL sin comillas sobrevive a la limpieza.

El caso 3 es el más interesante: no aparecía al probar "a mano" con la app limpia, porque la app no tiene URLs; apareció al exigir que el guardián detecte una violación real de la familia CSS. Ningún caso quedó sin resolver: la suite (34 casos) pasó completa, y el guardián sigue en exit 0 sobre `app/` y sobre sí mismo.

Salida representativa de la suite:

```
ℹ tests 34
ℹ pass 34
ℹ fail 0
```
