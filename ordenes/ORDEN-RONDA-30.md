# ORDEN DE TRABAJO — RONDA 30 · Terminar lo que la 29 dejó a medias

SGC · 2026-10-04 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué:
`EVALUACION-CICLO-29.md`

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`.

**Dos piezas, nada más.** Cada pieza termina así:

1. tests en verde;
2. **commit con cuerpo**, que diga qué cambió y qué test lo prueba;
3. `git push`.

**Si la sesión se corta, al retomar releés esta orden entera** y en el informe decís
dónde se cortó.

**Cada botón que se toca lleva un test que aprieta el botón.** Usá `generador-montura.js`
y `m.descargas`, y no llames funciones de las vistas.

---

## Pieza 1 · Presupuestos distintos de verdad, y los errores a la vista

commit: `Ronda 30 · presupuestos distintos y avisos a la vista`

| Qué | Dónde | Cambia |
|---|---|---|
| **a. Los 10 tests rotos.** Sus fixtures ponen los dos valores de un renglón en el **mismo** presupuesto, y desde la 29 la regla exige presupuestos distintos | `tests/ronda-28-c3.test.js:123-128`, `tests/ronda-28-c4.test.js:106-111`, `tests/ronda-29-p2.test.js:207-212` | Cargar **dos** presupuestos y usar uno distinto en cada valor del renglón |
| **b. El test que faltaba** | test nuevo, por la pantalla | Dos valores del mismo presupuesto → "Exportar" deshabilitado, con *"2 valores de referencia de presupuestos distintos en Renglón N"* (`core/validacion.js:202`) |
| **c. El aviso inmediato.** El Jefe eligió el mismo presupuesto dos veces y nada le avisó | `app/js/views/requerimiento-valores.js`, que es la misma vista en las dos aplicaciones | Apenas un renglón tiene dos valores completos del mismo presupuesto, debajo de ese renglón: *"Los dos valores tienen que salir de presupuestos distintos."* |
| **d. "Siguiente no hace nada."** Con un renglón incompleto, el motivo se escribe en `#sgc-paso-msj` (`app/generador.html:127`), arriba de todo, y el botón está en `:290`. El mensaje queda fuera de la pantalla | `app/js/views/wizard-formulario.js:64-65` | Cuando hay errores, `pasoMsj.scrollIntoView({ block: 'center' })` |

**Test:**

- la suite completa da **0 fallas**;
- el test (b);
- elegir el mismo presupuesto en las dos filas de un renglón → aparece el aviso (c);
- "Siguiente" con un renglón sin unidad → se llamó a `scrollIntoView` sobre
  `#sgc-paso-msj`.

## Pieza 2 · "Guardar avance" que se descarga

commit: `Ronda 30 · guardar avance en archivo`

**Lo que pidió la 29, y sigue valiendo:**

- **El botón `#sgc-guardar-avance`** (`app/generador.html:292`) **descarga**
  `requerimiento-<año>-<título>-v<N>-avance.json`.
  - Usa el mismo armado y la misma huella que "Exportar para Abastecimiento"
    (`generador/intercambio.js`, `armarArchivo` y `exportar`).
  - El sello lleva además `estado: "avance"` y `paso` (0 a 3).
  - Funciona con lo que haya cargado, **aunque esté incompleto**.
- **"Exportar para Abastecimiento"** sella `estado: "para-abastecimiento"`.
- **El aviso** *"Se descargó <archivo>"* va **al lado del botón**, a la vista. No va en
  `#sgc-generador-msj-revision`, que sólo se ve en el paso 4.
- **Se importa por el "Importar" de siempre** (`#sgc-archivo-modelo`, en el paso 1):
  - se verifican la huella y que los códigos existan;
  - **no** se exige completitud;
  - **abre en el `paso` guardado**;
  - con un byte cambiado, o con el `estado` cambiado a mano → *"el archivo fue modificado
    fuera del generador"*.
- **La descripción del ítem que vale es la del archivo.** Si el catálogo vigente la
  cambió, se avisa.

**Lo que sale, porque la 29 lo hizo por otro camino:**

- `guardarAvance` y `cargarAvance` con `localStorage` (`app/js/views/wizard.js:489-541`);
- el botón `#sgc-btn-importar-avance` (`app/generador.html:118`);
- su manejador (`app/js/generador.js:288-357`);
- la rama `tipo: 'sgc-generador-avance'` de `intercambio.js:499` y siguientes.

**Test, apretando el botón:**

1. un renglón sin valores, en el paso 2 → `m.descargas` tiene el archivo;
2. se importa → abre en el paso 2 con el renglón;
3. con un byte cambiado → error de huella;
4. con `estado` cambiado → error de huella;
5. con la descripción del ítem cambiada en el catálogo de la montura → queda la del
   archivo, y sale el aviso.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-30.md`**, con sus nueve secciones. Pegá **la salida completa** de esta
   corrida, hecha **después** del último commit de código:
   `node --test --test-timeout=120000 "tests/*.test.js" > %TEMP%\suite30.txt 2>&1`.
   Commit `Ronda 30 · informe` → `git push`.
2. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-30`.
3. **Paquete:** `node tools/empaquetar-generador.js --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
4. **Después del clon no se commitea nada.** Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes de que la hagas vos, **el revisor la corre en un navegador real**
(`AppOptimizar\PRUEBAS-JEFE\prueba-ronda-30.js`). Hoy da 2 de 9. Te avisa cuando dé 9 de 9.

1. Paso 2, un renglón sin unidad, "Siguiente" → **¿ves el motivo sin tener que subir?**
2. El mismo presupuesto en los dos valores de un renglón → **¿aparece el aviso ahí
   mismo?**
3. "Guardar avance" → **¿se descarga el JSON y ves "Se descargó …"?**
4. Cerrá todo, entrá de nuevo e importalo → **¿volvés al paso 2 con tus renglones?**
5. Con presupuestos distintos → **¿"Siguiente" te lleva a Fundamentación?**
