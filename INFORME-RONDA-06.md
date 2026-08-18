# INFORME — RONDA 6

## 1. Qué hice

- **Correcciones arrastradas (§2)**: las dos de código (2.1 borrador inválido, 2.2 validación de códigos por servidor). Detalle línea por línea en §9. Se hicieron primero, antes de cualquier pieza nueva.
- **`app/js/views/kanban.js`** (214 líneas) — el tablero (FSD §3, ADR-010): diez columnas, una por fase, armadas dinámicamente desde `config.FASES`; cada tarjeta muestra número, título, estado puntual (etiqueta dentro de la tarjeta), fase, último operador y fecha de última modificación; filtro por texto y por fase; **las tarjetas se pintan exclusivamente desde `GET /api/indice`** (ADR-005): el tablero nunca llama a `leerExpediente` (lo verifica un test con contador). Visibilidad global para todos los roles; sin arrastrar y soltar. Para mostrar el último operador sin abrir los expedientes, `repo.entradaIndice` ahora incluye `ultimoOperador` (`repo.js:203`, `contexto.email` o fallback a `expediente.ultimoUsuario`).
- **`app/js/views/expediente.js`** (371 líneas) + **`app/js/views/expediente-dialogo.js`** (210 líneas) — la vista de tarjeta (§3.2): datos, renglones, historial de auditoría cronológico con quién (correo), qué, cuándo y desde qué equipo; **Avanzar / Devolver habilitados sólo si el motor lo permite para algún rol del operador, y el botón deshabilitado muestra el motivo exacto que da el motor**; la devolución exige motivo del catálogo cerrado de `config.MOTIVOS_DEVOLUCION` y admite observación (sin motivo, el confirmar queda deshabilitado); con varios destinos, el operador elige. El diálogo de transición se extrajo a un módulo aparte para no superar las 400 líneas por archivo (regla R1).
- **Conflicto de concurrencia en pantalla (§3.3)** — cuando `guardarExpediente` devuelve `{conflicto:true}`, la vista muestra *"El expediente fue modificado por otro operador (versión actual en el servidor: N). No se guardó el cambio."* con un botón **Recargar expediente**. Nunca una excepción, nunca una sobrescritura silenciosa. El 409 real se fuerza en `servidor.test.js` (dos guardados sobre la misma versión) y en `expediente.test.js` con la vista.
- **`tools/recorrido-completo.js`** (198 líneas) — un expediente del paso 1 al 18 contra un servidor real, cambiando de operador en cada fase según el padrón, con una devolución (en `AUTORIZACION_SCo` → `ANALISIS_SCo`) y su reavance; al final imprime el recorrido y verifica `SGC.core.auditoria.verificarCadena`. Exporta `recorrer`, `planDePasos` y `OPERADORES` para poder testearse.
- **`app/js/core/config.js`** — agregado `FASES` (las diez fases del FSD §4, leídas de la documentación) expuesto como `SGC.core.config.FASES`.
- **Integración** — `app/index.html` (navegación Alta/Tablero, sección kanban, sección expediente y el diálogo de transición), `app/js/app.js` (cableado: selección de operador, alternar pantallas, abrir tarjeta desde el tablero, volver) y `app/css/main.css` (estilos del tablero, la tarjeta y el diálogo).
- **Tests (§3.5)** — `tests/kanban.test.js` (3 casos), `tests/expediente.test.js` (6 casos), `tests/recorrido.test.js` (2 casos), un caso nuevo de Fast-Track con el servidor de catálogo caído en `tests/wizard.test.js`, y el caso del 409 real en `tests/servidor.test.js`. Total de la suite: **154 tests, 0 fallos**.
- **`INFORME-RONDA-06.md`** — este informe.

## 2. Decisiones que tomé y por qué

- **Diez columnas por fase, no dieciocho por estado (ADR-010).** Las columnas se construyen dinámicamente desde `config.FASES` para que el tablero y la configuración no se desincronicen (test 6 de `config.test.js` ya verifica que los estados cubren las fases 1..10). El estado puntual va como etiqueta de la tarjeta.
- **El tablero es de sólo índice (ADR-005).** No hay `datos.json` que pintar: cada tarjeta sale de la entrada del índice. Eso exigió un campo nuevo en `entradaIndice` (`ultimoOperador`), porque la tarjeta debe mostrar el último operador y no se puede ir a buscarlo abriendo el expediente (sería una lectura de `datos.json` por tarjeta).
- **La vista decide los botones con el motor, nunca con el servidor ni por su cuenta.** `rolPara(expediente, accion)` itera los roles del operador activo y usa el primero que el motor habilite (así un operador multi-rol como Carlos opera con el rol correcto de cada estado); si ninguno, muestra el motivo del primer rol. El servidor sigue siendo, desde la ronda 3, un almacén versionado: la autorización de la transición vive en el motor de dominio (ver §6, riesgo declarado).
- **La devolución exige motivo del catálogo cerrado y el diálogo no deja confirmar sin él.** Los destinos de devolución los da el motor (`puedeDevolver.destinos`), no se inventan en la vista; el motivo sale de `config.MOTIVOS_DEVOLUCION`; la observación es opcional. La transición se ejecuta recién al confirmar.
- **El avance con un único destino actúa directo.** Preguntar por un destino que es el único sería fricción sin información; el diálogo sólo aparece cuando hay que elegir entre varios destinos o cuando hay que dar motivo y observación (devolución).
- **El diálogo de transición es un módulo aparte.** `expediente-dialogo.js` concentra abrir/confirmar/cancelar, la construcción del contexto y la escritura al repo, y traduce el 409 a un resultado `{conflicto:true}` sin lanzar. La vista de expediente quedó en 371 líneas y el diálogo en 210.
- **El conflicto es un estado de la vista, no una excepción.** `guardarExpediente` ya resuelve el 409 desde la ronda 3; la novedad es que la vista lo muestra y ofrece recargar, y que al recargar se re-lee el expediente fresco (nada de lo que el operador escribió en esa operación fallida se perdió de forma silenciosa: el cambio no se guardó y el aviso lo dice).
- **En el recorrido, la devolución se inyecta antes de abandonar `AUTORIZACION_SCo`.** La única devolución con camino de reavance natural es `AUTORIZACION_SCo → ANALISIS_SCo` (la de `DICTAMEN_INICIAL → CONFECCION_PROYECTOS` también existe, pero el plan elige la de fase abastecimiento). Si se hubiera avanzado hasta el final y devuelto al final, no habría reavance posterior: la devolución debe ocurrir y reavanzarse en el medio. El bucle corre `while (estadoActual !== config.ESTADO_FINAL)`.
- **El Fast-Track valida la existencia de los códigos contra el servidor, no bajando el universo (§2.2).** Estructura y tipos primero, sin tocar la red (un archivo mal formado se rechaza localmente); la existencia de los códigos en una segunda fase por `POST /api/catalogo/validar-codigos`. Si el servidor no está disponible, el archivo **no se acepta** y el aviso lo dice (wizard.js:280-284 y 306-312; test dedicado).
- **El máximo de códigos por llamada quedó documentado en el código.** `MAX_CODIGOS_POR_LLAMADA = 1000` en `servidor.js:66`, declarado en la cabecera del servidor (líneas 37-38); el cliente no particiona (un archivo Fast-Track con más de 1000 renglones es irreal y lo rechaza el servidor con 400).

## 3. Verificación

`node --test` (desde la raíz, en el repositorio de trabajo): **154 tests, 0 fallos** (~45 s).

`node --test` en un clon limpio (copiado del árbol de trabajo a `os.tmpdir()`, sin `.git`, sin `datos-prueba/`): **verde**. Ver §9 y criterio 1.

`node tools/check-compat.js` (desde la raíz):

```
check-compat: OK - 24 archivo(s) inspeccionado(s), 0 violaciones.
```

Además:
- **Criterio 3 (borrador inválido)**: `renglones` ausente, `null`, cadena, número, objeto y arreglo con elementos que no son objetos: mensaje legible, el borrador sigue ofrecido, el formulario no se toca, sin excepción (test en `wizard.test.js`).
- **Criterio 4 (Fast-Track sin `codigos.json` en el cliente)**: el build ya no emite `app/catalogo/codigos.json` (verificado: el archivo no existe en el árbol y `tools/build-catalogo.js` no lo nombra); la existencia la valida el servidor; sin servidor el archivo no se importa (test dedicado).
- **Criterio 5 (tablero sólo desde el índice)**: test con contador — pintar el tablero hace 1 llamada a `listarIndice` y 0 a `leerExpediente` (`kanban.test.js`).
- **Criterio 6 (diez fases)**: el test verifica 10 columnas con los títulos de `config.FASES` y la lista correcta de tarjetas por fase.
- **Criterio 7 (matriz de permisos)**: `expediente.test.js` recorre los 18 estados × 7 roles × avanzar/devolver y compara el estado de cada botón y el texto del motivo con el veredicto del motor (`puedeAvanzar`/`puedeDevolver`). Los 18.
- **Criterio 8 (devolución sin motivo válido)**: sin motivo el confirmar queda deshabilitado; con motivo del catálogo se habilita y la transición llega al repo con la auditoría completa (test).
- **Criterio 9 (conflicto)**: dos guardados sobre la misma versión → 409 real en `servidor.test.js`; la vista muestra el aviso y ofrece recargar (`expediente.test.js`).
- **Criterio 10 (recorrido)**: `tools/recorrido-completo.js` contra servidor real, 18 estados con devolución y reavance, 20 entradas de auditoría, `verificarCadena` íntegra; lo mismo aseverado por test (`recorrido.test.js`). Salida real en §7.
- **Criterio 11 (tablero con 100 expedientes)**: medición propia, ver §7.
- **Criterio 12 (informe)**: este archivo, con sus nueve secciones.
- **Regresiones**: la suite completa (154) cubre concurrencia de PUT (20 simultáneos: 1×200 y 19×409), POST concurrente (20 ids distintos), numeración, recorrido de rutas, presupuesto del catálogo, alta completa y Fast-Track hostil.
- Dependencias de terceros: cero. Temporales de test: todos en `os.tmpdir()`. `grep estadoActual app/` (criterio 6 corregido en la §2.3 de la orden): sólo las 2 ocurrencias vivas de `migraciones.js`, ahora explícitamente exceptuadas por la propia orden.

## 4. Contradicciones e información faltante

1. **`expediente.js` y `expediente-dialogo.js` comparten el árbol del diálogo.** La vista delega el montaje del diálogo a `expediente-dialogo.js` (`montar` → `dialogo.montar(raiz)`), y el test construye un solo árbol con los ids de ambos. No hay contradicción con la documentación, pero es un acoplamiento por ids: si un id del diálogo cambia en `index.html`, hay que tocarlo en dos módulos y en el test.
2. **El servidor no valida roles ni transiciones en `PUT /api/expedientes/:id`.** La orden §3.2 pone la autorización en la vista ("habilitado sólo si `puedeAvanzar` lo permite para el operador activo") y la ronda 3 fijó al servidor como almacén versionado sin conocimiento del motor. La orden de auditoría de este ciclo pregunta explícitamente (su §2.3) si se puede avanzar saltando la vista. La respuesta es que sí: el motor valida en el cliente y el servidor persiste. Lo declaro en §6 como riesgo de severidad alta pendiente de decisión; no lo resolví por cuenta propia (regla R1 §0).
3. **`MAX_CODIGOS_POR_LLAMADA = 1000` es un límite que la orden no especifica.** "Un máximo razonable de códigos por llamada" (§2.2) no da número; elegí 1000 y lo documenté en la cabecera del servidor y en el test (400 con 1001). Si la batería externa espera otro límite, es el primer punto a revisar.

## 5. Qué NO hice

- **No agregué validación de roles en el servidor** (ver §4.2 y §6): no está en la orden y la ronda 3 definió al servidor como almacén versionado sin motor; cambiar eso es una decisión de arquitectura que no me toca tomar solo.
- **No edité ninguna documentación**, incluida `BITACORA_DECISIONES.md` y las órdenes. La única ADR nueva de este ciclo (si el revisor decide que el servidor debe autorizar) la escribiría el revisor.
- **No toqué** `tools/check-compat.js`, `tools/scraper-catalogo/` ni la batería del auditor en `auditoria/`.
- **No usé IndexedDB ni localStorage**; el borrador sigue en `sessionStorage`.
- **No dejé** archivos temporales ni `datos-prueba/` en el repositorio (sigue en `.gitignore`).
- **No hice commit ni push hasta el cierre**: un solo commit local al final, `git status` limpio.

## 6. Riesgos que veo

- **Severidad alta, pendiente de decisión: el servidor no autoriza las transiciones.** Cualquiera con acceso a la API puede avanzar un expediente saltando la vista, porque el servidor persiste lo que recibe (con chequeo de versión) y el motor de dominio vive en el cliente. La orden de este ciclo no lo exige, pero la del auditor lo pregunta (su §2.3). Si el sistema pasa a ser multiusuario real en red, esto es la primera cosa a endurecer: el servidor debería reconstruir el estado y correr `puedeAvanzar`/`puedeDevolver` con el rol que declara el contexto — con la salvedad de que el contexto también lo manda el cliente, así que habría que definir de dónde sale la identidad de confianza (ADR-017).
- **La capa DOM se probó con un stub mínimo, no con un navegador.** El flujo lógico está cubierto y destapó dos bugs reales (motivo de devolución que se borraba antes de confirmar, y el repo/árbol del diálogo que había que montar aparte), pero el recorrido real por teclado, `aria-live` y el diálogo modal los verificará la batería externa.
- **`expediente.js`/`expediente-dialogo.js` comparten ids por contrato.** Cualquier cambio de id en `index.html` obliga a tocar ambos módulos y el test. Bajo riesgo; es el precio de respetar las 400 líneas.
- **`wizard.js` quedó en 437 líneas**, por encima del límite de 400 desde la ronda 5 (heredado; este ciclo sólo le agregó la guardia del §2.1 y el camino de servidor caído). No lo toqué más allá de lo necesario para no mezclar la corrección con una refactorización. `servidor.test.js` quedó en 518 líneas, también por encima del límite, acumulando casos de todos los ciclos.
- **El test de alta completa y el de recorrido dependen de arrancar el servidor real** (puerto 0 en `os.tmpdir()`): son los casos más lentos de la suite (~2-3 s cada uno) y los más sensibles a máquinas lentas, pero no hay flake observado en esta ronda.
- **`check-compat.test.js` conserva su flake preexistente** bajo carga paralela ("js-map-groupBy" a veces hace timeout); pasa 34/34 en aislamiento. No es de esta ronda.

## 7. Mediciones

**Carga del tablero con 100 expedientes (criterio 11), contra el servidor real** en `os.tmpdir()`, medición propia con `process.hrtime` alrededor de `GET /api/indice`:

```
100 expedientes creados en 4916 ms (~49 ms por alta)
GET /api/indice con 100 entradas: 776 ms, 25.093 bytes
GET /api/indice (2da corrida, caché del sistema de archivos): 213 ms
```

Primera corrida 776 ms, por debajo del segundo que pide el criterio; con el índice caliente, 213 ms. El índice fragmentado (ADR-005) no requiere leer ningún `datos.json`.

**Recorrido completo (criterio 10), salida real de `tools/recorrido-completo.js`:**

```
Recorrido completo 2026-001:
  crearExpediente -> generador => ESPECIFICACIONES_TECNICAS
  avanzar -> generador => SOLICITUD_CONTRATACION
  avanzar -> abastecimiento => ANALISIS_SCo
  avanzar -> abastecimiento => AUTORIZACION_SCo
  devolver -> abastecimiento_supervisor => ANALISIS_SCo
  avanzar -> abastecimiento => AUTORIZACION_SCo
  avanzar -> abastecimiento_supervisor => REVISION_SCo
  avanzar -> contrataciones => CONFECCION_PROYECTOS
  avanzar -> contrataciones => DICTAMEN_INICIAL
  avanzar -> juridica => DILIGENCIA
  avanzar -> contrataciones => FIRMAS_PLIEGO_DISPOSICION
  avanzar -> contrataciones_supervisor => PUBLICACION
  avanzar -> contrataciones => APERTURA_PEDIDO_INFORMES
  avanzar -> contrataciones => EVALUACION
  avanzar -> contrataciones => DICTAMEN_FINAL
  avanzar -> juridica => FIRMA_DISPOSICION
  avanzar -> contrataciones_supervisor => ADJUDICACION
  avanzar -> contrataciones => AFECTACION
  avanzar -> contaduria => GENERACION_ORDEN_COMPRA
  avanzar -> contrataciones => PERFECCIONADA
Auditoría: 20 entradas, cadena íntegra: true
```

**Líneas por archivo nuevo/principal** (regla de ≤400): `kanban.js` 214, `expediente.js` 371, `expediente-dialogo.js` 210, `recorrido-completo.js` 198, `wizard.js` 437 (heredado, ver §6), `config.js` 288, `app.js` 104. Tests: `kanban.test.js` 190, `expediente.test.js` 414, `recorrido.test.js` 91, `wizard.test.js` 375, `servidor.test.js` 518.

Suite completa: 154 tests en ~45 s.

## 8. Accesos fuera del repositorio

Necesité exactamente las dos cosas que la §0 autoriza, y nada más:

1. **`os.tmpdir()`** — carpetas temporales de datos del servidor para la medición de §7, el recorrido real y el clon limpio de verificación.
2. **Puertos locales `127.0.0.1`** — el servidor real en los tests de integración y en `recorrido-completo.js` (puerto 0).

No se denegó ningún acceso ni quedó trabajo interrumpido por permisos.

## 9. Correcciones arrastradas

- **2.1 — Retomar un borrador viejo o corrupto revienta.** `borrador.js` agregó `validarForma(datos)` (línea 61): chequea que `datos` sea objeto y que `renglones` sea un arreglo de objetos con `codigo`, `cantidad` y `unidad` bien formados; `wizard.js:198` lo aplica en `retomarBorrador` y, si la forma no pasa, muestra *"El borrador guardado no se puede aplicar: <motivo>"* y **deja el aviso ofrecido** (no desaparece, no se aplica nada, sin excepción). Test en `wizard.test.js` cubre `renglones` ausente, `null`, cadena, número, objeto, y arreglo con elementos que no son objetos (más formas que las dos que reprodujo la batería adversaria).
- **2.2 — No bajes 2,5 MB al cliente para validar códigos.** El cliente dejó de bajar el universo: `tools/build-catalogo.js` ya no emite `app/catalogo/codigos.json` y el archivo fue borrado del repositorio (`git rm`). La existencia de los códigos del Fast-Track la valida el servidor por `POST /api/catalogo/validar-codigos` → `{invalidos, catalogoVersion}` (`servidor.js:396`), con máximo `MAX_CODIGOS_POR_LLAMADA = 1000` documentado en la cabecera (líneas 37-38) y 400 si se supera; `repo.http.validarCodigos` (línea 141) lo expone al wizard, que sin servidor **no acepta el archivo** (wizard.js:280-284 y 306-312). Test de servidor: lista con inexistentes y duplicados → devuelve exactamente los inexistentes; lista vacía y todos válidos → `[]`; 1001 → 400; no-arreglo → 400. Test de wizard: servidor caído → el archivo no se importa y el aviso lo dice.
- **2.3 — Criterio corregido por la orden.** No requería acción: la excepción de `migraciones.js` quedó explícita en la orden y el criterio 6 de §5 quedó satisfecho sin tocarla (ver §3).