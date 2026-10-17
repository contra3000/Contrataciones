# ORDEN DE TRABAJO — RONDA 39 · Corrección de la 38, las cantidades de la OCA y los códigos con separadores raros

SGC · 2026-10-17 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué:
`PLAN_DESARROLLO.md` §0.1 (17/10).

- Primero va **la corrección de la 38** (ítem 25): la ronda 38 no pasó entera
  (`prueba-ronda-38.js`, 17/18), así que vuelve (paso 4.5).
- Después, los dos primeros ítems de la cola: el **26** (N2) y el **4** (N3 del 13/10).

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Una corrección y dos piezas.**

- **Cada commit: la suite completa en verde → commit con cuerpo** (qué cambió y qué test lo
  prueba) → `git push`. Recién después empezás lo siguiente.
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/` no se toca;
  - sus tests no se modifican;
  - su requerimiento sale igual byte a byte, **salvo la línea de la causal de la OCA**
    (pieza 1b), y sólo en un expediente con OCA.
  - **Las reglas nuevas de cantidades van en el generador, no en `core/`.**
- **El informe describe cada test viejo que cambió**, uno por uno.

---

## Paso 0b · Corrección de la 38: el aviso rojo que queda

commit: `Ronda 38 · corrección: el aviso de la justificación se va con "Sigue valiendo"`

**Qué pasa** (`PRUEBAS-JEFE\prueba-ronda-38.js`, paso 2, sobre `r38-fa1817c`):

1. Con las causas cambiadas, la persona aprieta **"Siguiente"** en Fundamentación. No pasa,
   y aparece debajo del campo *"Revisá la justificación del PAC: cambiaron las causas."*
   (`#sgc-error-pac-justificacion`).
2. Aprieta **"Sigue valiendo"**: se resuelve la revisión, el campo deja de estar marcado
   y exporta.
3. **Pero ese texto rojo sigue a la vista** hasta que cambia de paso.

La orden 38 (pieza 1b) lo pedía, y la 37 lo había dejado. Sin el paso 1 no aparece, por
eso tu test no lo vio.

**Cambia:** `escribirJustificacionDelPac()` (`views/wizard.js:469`) también **oculta y
vacía** `#sgc-error-pac-justificacion` (`:659`) cuando se confirma o se edita el texto.

**Test, por la pantalla:** con las causas cambiadas:

1. "Siguiente" → el texto aparece;
2. "Sigue valiendo" → **ningún texto con "cambiaron las causas" a la vista**, sin cambiar
   de paso.

Lo mismo editando el texto en vez del botón.

## Pieza 1 · Las cantidades de la OCA, y la cita completa de la causal

commit: `Ronda 39 · cantidades de la OCA y cita de la causal`

**Lo que vio el Jefe (17/10):** con OCA, *"la cantidad máxima me deja poner un valor más alto
que la cantidad que puse en el renglón"*.

**La norma** (`AppOptimizar\EjemplosProcesoActual\COMPENDIO_NORMATIVO_AGOSTO_2024_COMPLETO.md`,
Decreto 1030/2016):

- **art. 25 inc. c):** define la modalidad;
- **art. 111:** regula la orden de compra abierta;
- **art. 112:** *"La jurisdicción o entidad contratante determinará, para cada renglón …, el
  número máximo de unidades que podrán requerirse durante el lapso de vigencia del
  contrato…"*.

**Lo que decidió el Jefe el 17/10:**

- **la cantidad del renglón es el máximo del contrato**;
- **la máxima por Solicitud de Provisión no puede superarla**;
- **la mínima no puede superar la máxima**.

**Cambia:**

**a. En la revisión del generador** (`generador/documentos.js:205-215`, donde hoy se pide la
cantidad máxima), con OCA:

- si la máxima por Solicitud de Provisión supera la cantidad del renglón: *"Renglón N: la
  cantidad máxima por Solicitud de Provisión (X) no puede superar la cantidad del renglón
  (Y)"*;
- la mínima contra la máxima: el núcleo tiene la regla (`validarCantidades`,
  `core/requerimiento.js:186`), **pero hoy el generador no la aplica**. Medido sobre
  `r38-fa1817c`: con máxima 5 y mínima 8 exporta. Que la aplique, con el mensaje del
  núcleo.

En pantalla, el renglón queda marcado y "2 · Renglones" dice "falta". No imprime ni exporta.
**Esta regla no va en `core/requerimiento.js`**, que es de la aplicación con servidor.

**b. La cita** (`renders/requerimiento.js:52-55`) y la guía de la justificación de la OCA
en Fundamentación pasan a decir **"Decreto 1030/2016, arts. 25 inc. c) y 111"**.

**Test, por la pantalla:**

1. **OCA con cantidad 10 y máxima 12:**
   - no imprime ni exporta;
   - el motivo nombra el renglón y los dos números;
   - "2 · Renglones" dice "falta".
2. **Máxima 10:** exporta.
3. **Máxima 5 y mínima 8:** no exporta, y el motivo habla de la mínima. Hoy exporta.
4. El requerimiento con OCA dice "Decreto 1030/2016, arts. 25 inc. c) y 111", y la guía
   de Fundamentación también.

## Pieza 2 · Los códigos con separadores raros

commit: `Ronda 39 · códigos con separadores raros`

**Lo que vio el Jefe (13/10):** en los Word los códigos vienen como `3.3.3   1627  36`, con
tabulaciones, guiones o puntos de más. El asistente los deja vacíos, o los copia así, y
entran "por buscar" aunque el ítem `3.3.3-1627.36` existe.

**Y lo que midió el revisor (13/10):** un renglón con un código que no existe **pierde las
palabras de "buscar"** que puso el asistente, y "Buscar" pone el código en el buscador.

- `views/fasttrack.js:194` arma el renglón sin `buscar`.
- `generador/intercambio.js:1079` pone `buscar = codigo`.

**Cambia:**

**a. El importador normaliza el código antes de validarlo.** Si tiene la forma de 3
dígitos, un número y otro número, separados por puntos, espacios, tabulaciones o guiones
en cualquier combinación, lo reescribe como `d.d.d-NNNN.N`. Por ejemplo:

| Entra | Sale |
|---|---|
| `3.3.3   1627  36` | `3.3.3-1627.36` |
| `3.3.3\t\t1627\t\t36` | `3.3.3-1627.36` |
| `3.3.3-1627-36` | `3.3.3-1627.36` |
| `3.3.3.1627.36` | `3.3.3-1627.36` |

Después se valida contra el catálogo, como hoy. Si existe, entra listo con su descripción.
El aviso de importación dice cuántos códigos se acomodaron.

**b. Un código que no existe conserva el `buscar` del asistente**, y "Buscar" usa esas
palabras. Sólo si no hay `buscar`, usa el código.

**c. Las instrucciones de la plantilla** (`views/fasttrack.js:51-60`, regla 3) cambian
así:

- **sale** *"con la forma 2.9.6-1115.1"*;
- **queda** *"copialo tal como aparezca en los documentos, aunque tenga espacios,
  tabulaciones, puntos o guiones de más (por ejemplo `3.3.3 1627 36`): el SGC lo
  acomoda"*.

El resto de las instrucciones no cambia.

**Test, por la pantalla:**

1. "Pegar texto" con los cuatro códigos de la tabla → los cuatro entran como
   `3.3.3-1627.36`, **ninguno "por buscar"**, y el aviso dice que se acomodaron.
2. Un renglón con `9.9.9-0000.0` y `"buscar": "matafuego"` → queda "por buscar", y
   "Buscar" pone **"matafuego"** en el buscador.
3. La plantilla trae las instrucciones nuevas.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-39.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   **Incluye la corrección de la 38.**
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-39`.
4. **Paquete:** `node tools/empaquetar-generador.js --ronda 39 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-39.js` y las de las rondas 30 a 38.
**Esperá a que te diga que pasaron enteras.** Escribí tu devolución en
`PRUEBAS-JEFE\DEVOLUCION-RONDA-39.md`.

1. Con OCA, poné una cantidad máxima mayor que la cantidad del renglón. **¿Te frena y te dice
   por qué?**
2. Pegá una respuesta del asistente con códigos como `3.3.3   1627  36`. **¿Entran con su
   descripción, sin quedar "por buscar"?**
3. Con las causas del PAC cambiadas, apretá "Siguiente" y después "Sigue valiendo". **¿Se va
   el texto rojo?**
