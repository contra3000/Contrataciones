# ORDEN DE TRABAJO — RONDA 29 · El Usuario como lo pidió el Jefe

SGC · 2026-10-03 · hito **H27** · Reglas: `CICLO_DE_TRABAJO.md` · Decisión: ADR-044

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`.

**Vale** la §0 de `ORDEN-RONDA-01.md`. **Cada pieza: tests en verde → commit y push en
el momento.**

---

## ⚠️ Lo que no se hace más (incidente de la ronda 28, `EVALUACION-CICLO-28.md` §2)

- **Fuera del repositorio, nunca borrar ni mover.** No uses `Remove-Item -Recurse`,
  `rm -r`, `Move-Item` ni `mv` en ninguna ruta que no esté dentro de `os.tmpdir()` o del
  `dist/` del repositorio.
- **El clon del auditor se hace con la ruta absoluta**, la de abajo, copiada tal cual.
  Si algo de `AppOptimizar\auditoria\` te parece mal puesto, **te detenés y lo decís en
  el informe**; no lo corregís.
- **Después del clon no se commitea nada.** Las dos líneas de HEAD van en tu mensaje
  final, no en el informe.

## Pieza 1 · La suite en cero · commit: `Ronda 29 · suite en cero`

| Qué | Dónde | Cambia |
|---|---|---|
| **a. Carrera en los tests.** El "antes" se toma después de la acción, así que si la recarga llega primero, la espera vence | `tests/helpers/aplicacion-montura.js:422-431`, `tests/helpers/circuito-ronda-21.js:98-108` y `:113-125`, `tests/ronda-20.test.js:45-54`, `:159` y `:198-207` | Tomar `previo` / `previoHito` **antes del `click()`**. Está hecho en `ordenes/PARCHE-RONDA-29-carrera-tests.patch` (`git apply`; si no entra por los finales de línea, son 5 cambios a mano). El revisor lo verificó: `ronda-20` y `ronda-21-c6` en verde |
| **b. libuv en Windows.** `presupuestos-servidor` aborta en `async.c:94` cuando `--test-force-exit` llama a `process.exit` con conexiones abiertas (Node 24) | la corrida, o el `after` de `tests/presupuestos-servidor.test.js:60` | Medí primero ese archivo 3 veces **con** y 3 veces **sin** `--test-force-exit`, en esta PC. Arreglalo por la causa: cerrar las conexiones antes de salir, o sacar el flag si la suite igual termina sola |
| **c. El stub no vacía.** `set textContent` no borra los hijos | `tests/helpers/dom-stub.js:152` | Que vacíe `children`, como el navegador. Los tests de "tres renglones reales" (`ronda-28-c3`, `c4`) además **afirman tres códigos distintos** |
| **d. Finales de línea.** No hay `.gitattributes`, y en Windows el clon sale en CRLF y `build-config --verificar` falla aunque no haya error | raíz del repositorio | `.gitattributes` con `* text=auto eol=lf`, y binarios (`*.pdf`, `*.png`, …) como `binary` |

**Test:** en **esta PC**, la suite completa da **0 fallas, 0 salteados, 0 cancelados**, y
termina sola. El comando que quede es el que va al informe y a `CICLO_DE_TRABAJO.md`.

## Pieza 2 · Quién sos, y los documentos sin firma · commit: `Ronda 29 · identidad y documentos`

**Cambia:**

- **La pantalla "¿Quién sos?"** (`app/generador.html:40-52`, `app/js/generador.js:118-146`
  y `:236-241`) pide **cuatro datos obligatorios antes de elegir el rol**:
  1. **Grado.** Desplegable, en este orden: Personal Civil, Cabo, Cabo Primero, Cabo
     Principal, Suboficial Auxiliar, Suboficial Ayudante, Suboficial Principal,
     Suboficial Mayor, Alférez, Teniente, Primer Teniente, Capitán, Mayor,
     Vicecomodoro, Comodoro, Brigadier.
  2. **Nombre.**
  3. **Apellido.**
  4. **Número de Control.** Sólo un entero, que se muestra con punto de miles:
     `12345` → `12.345`.
- **Lo que ven los demás:** el operador a la vista y el sello del JSON llevan los cuatro
  datos: `grado`, `nombre`, `apellido` y `numeroControl` (entero). Un JSON viejo con
  sólo `nombre` se sigue importando.
- **Los documentos que van al sistema de firmas no llevan "Operador solicitante" ni el
  espacio de firma.** Es el requerimiento, la EETT y el anexo de EETT
  (`renders/requerimiento.js:306`, `especificacion-tecnica.js:81`, `anexo-eett.js:177`),
  **en las dos aplicaciones**. Los demás documentos no se tocan.

**Test:**

- sin grado, o con el número de control `12a`, no se entra;
- `12345` se ve `12.345`;
- el sello lleva los cuatro datos;
- los tres documentos impresos no contienen "Operador solicitante" ni "Firma y
  aclaración", y el ANEXO I sigue igual.

## Pieza 3 · Guardar el avance en cualquier paso · commit: `Ronda 29 · guardar avance`

**Cambia:**

- **Un botón "Guardar avance (JSON)" visible en los cuatro pasos, siempre habilitado.**
  Descarga `requerimiento-<año>-<título>-v<N>-avance.json`, con el mismo sello y la
  misma huella, más `estado: "avance"` y `paso: <el paso en que estaba>`.
- **"Exportar para Abastecimiento" no cambia**: sigue exigiendo todo, y sella
  `estado: "para-abastecimiento"`.
- **Importar un avance:**
  - valida la forma, que los códigos existan en el catálogo y la huella;
  - **no** exige lo de completitud: los dos valores por renglón y los campos;
  - **abre en el paso guardado**;
  - sigue sin cargar nada a medias.
- **La descripción del ítem:** al importar manda **la que trae el archivo**, porque es
  la que se firmó. Si el catálogo vigente la cambió, se avisa en el mensaje.

**Test:**

- un renglón sin valores, guardado en el paso 2 → se importa → abre en el paso 2 con
  el renglón;
- un avance con un byte cambiado → error de huella;
- el mismo archivo con el estado cambiado a mano a `para-abastecimiento` → error de
  huella.

## Pieza 4 · Presupuestos · commit: `Ronda 29 · presupuestos distintos y adjuntos`

**Cambia:**

- **Los dos valores de un renglón tienen que salir de presupuestos distintos.** Es una
  regla del núcleo, así que vale en las dos aplicaciones.
  - **Dónde:** `app/js/core/validacion.js:94-105`, `renglonesSinValores`: contar
    `presupuestoId` **distintos** entre los valores completos.
  - **Qué dice:** *"2 valores de referencia de presupuestos distintos en Renglón N"*.
  - Lo usan "Exportar" y el importador, que ya llaman a `validarParaAvanzar`.
- **Elegir el PDF del presupuesto** en "Presupuestos de referencia"
  (`app/generador.html:185-203`):
  - un `<input type="file">` que **no sube nada** y completa solo el nombre;
  - guarda el **tamaño en bytes** y la **huella SHA-256** del archivo, con la misma
    función de huella del sello;
  - proveedor y fecha se siguen escribiendo a mano;
  - un JSON viejo sin huella de PDF se sigue importando.
- **La leyenda** en el requerimiento, en las dos aplicaciones: *"Se acompañan como
  adjuntos los presupuestos de referencia: <nombre> (<proveedor>, <fecha>); …"*.

**Test:**

- dos valores del mismo presupuesto → no se exporta, y sale el texto de arriba;
- con un PDF de fixture → el JSON trae su tamaño y su huella, y la huella es igual a
  la SHA-256 calculada aparte;
- el requerimiento impreso tiene la leyenda con los nombres.

---

## Cierre · siempre igual, con dos cambios

1. **`INFORME-RONDA-29.md`**, con sus nueve secciones y el comando de la suite que
   quedó. Commit `Ronda 29 · informe` → `git push`.
2. **Clon, con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-29`. Si existe,
   no se toca y se avisa.
3. **Rearmá el paquete:** `node tools/empaquetar-generador.js --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
4. **No se commitea nada más.** En tu mensaje final van el HEAD de `dev\` y el del clon,
   que tienen que ser el mismo.

## Tu prueba de 10 minutos · para el Jefe

1. Abrí `SGC-Generador\generador.html`. **Sin grado o sin número de control, ¿te deja
   elegir el rol?** No tiene que dejarte. Con `12345`, ¿ves `12.345`?
2. Cargá dos renglones y, en el paso 2, **"Guardar avance"**. Cerrá todo, abrí de nuevo
   e importalo: **¿volvés al paso 2 con los renglones?**
3. Poné dos valores del **mismo** presupuesto: **¿te frena con el aviso?**
4. Agregá un presupuesto **eligiendo el PDF**.
5. Terminá e imprimí el requerimiento: **¿no tiene "Operador solicitante" ni la línea
   de firma, y sí la frase de los adjuntos?**

## Pasa a la ronda 30

**Fundamentación con PAC y OCA:**

- el desplegable del PAC en Identificación, con el monto preventivo del proceso;
- *"Requerimiento no autorizado en el PAC"*;
- la justificación del PAC, cuando el preventivo **supera** el del PAC o no está en
  el PAC;
- la modalidad común u OCA, con su justificación y una línea de ayuda normativa;
- "Objetivo" sale.

El PAC 2026 ya está convertido en
`AppOptimizar\ACTUALIZACION-SEMESTRAL\PAC\`: 39 procesos, que suman exactamente el
total del PDF.
