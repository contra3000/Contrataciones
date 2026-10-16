# ORDEN DE TRABAJO — RONDA 37 · El lugar de entrega en el requerimiento, y la justificación del PAC que se revisa

SGC · 2026-10-16 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: los dos primeros
ítems de la cola (`PLAN_DESARROLLO.md` §0.1, 16/10), el 22 y el 23, los dos N2, con las
decisiones del Jefe del 16/10.

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza: la suite completa en verde → commit con cuerpo** (qué cambió y qué test lo
  prueba) → `git push`. **Recién después empezás la siguiente.** En la 36 se cumplió: así
  sigue.
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/` no se toca;
  - sus tests no se modifican;
  - el requerimiento de un expediente suyo sale **igual byte a byte**.
- **El informe describe cada test viejo que cambió**, uno por uno.

---

## Pieza 1 · El requerimiento dice el lugar de entrega

commit: `Ronda 37 · lugar de entrega en el requerimiento`

**La pregunta del auditor 36:** sin "Lugar", el requerimiento que se firma no dice dónde se
entrega.

**Lo que decidió el Jefe el 16/10:** el requerimiento **repite el lugar de entrega que
escribió la persona**, el mismo texto que la EETT. Como sale del mismo campo, no pueden
contradecirse.

**Cambia:**

- `renders/requerimiento.js`, `paresEncabezado()` (`:90`), suma la fila **"Lugar de
  entrega"** con `datos.identificacion.lugarEntrega`.
  - Va **sólo si el expediente lo trae**, igual que las filas del PAC (`:121-131`).
  - En la aplicación con servidor no viene, y su requerimiento sale igual byte a byte.
- **No vuelve "Lugar"** con la constante.

**Test, por la pantalla:**

1. Con el lugar "Depósito de Intendencia, Hangar 3", el requerimiento tiene "Lugar de
   entrega" con ese texto, y la EETT también.
2. Ningún documento dice "VII Brigada Aérea - Moreno".
3. El requerimiento de la aplicación con servidor, igual byte a byte que en `bf3ba2d`.

## Pieza 2 · La justificación del PAC se revisa cuando cambian las causas

commit: `Ronda 37 · revisar la justificación del PAC cuando cambian las causas`

**Qué pasa hoy** (medido sobre `r36-bf3ba2d`, paso 9 de `PRUEBAS-JEFE\prueba-ronda-34.js`):

1. Con el proceso 4 y el monto superado, la persona justifica el monto.
2. Después elige "No autorizado en el PAC".
3. **La misma justificación vale para la causa nueva**, y exporta.

El requerimiento sale con un texto que justifica otra cosa. Viene de la 36, pieza 1e: lo
escrito se conserva, y nadie lo vuelve a mirar.

**Lo que decidió el Jefe el 16/10:** si las causas cambian después de escribir la
justificación, **el campo pide revisarla**, y no deja exportar hasta que se edite o se
confirme que sigue valiendo.

**Cambia:**

**a. Las causas con nombre.** `causasDelPac()` (`core/validacion.js:113`) devuelve
también `claves`: la lista de las que se cumplen, entre `fuera-del-pac`, `anio`, `trimestre`
y `monto`.

**b. La justificación recuerda para qué causas se escribió.**

- `pac.causas` guarda las `claves` **cuando la persona escribe la justificación o la
  confirma**.
- Viaja en el JSON y en el avance.

**c. Si las `claves` de ahora no son las guardadas** (aparece una causa o se va otra; un
cambio de monto con la misma causa no cuenta):

- arriba del campo, en Fundamentación, el aviso *"Cambiaron las causas desde que
  escribiste la justificación: revisala."*, con las causas nuevas, y el campo con
  `campo-con-error`;
- un botón **"Sigue valiendo"** (`#sgc-pac-justificacion-confirmar`), que guarda las
  `claves` de ahora sin cambiar el texto;
- **editar el texto** también las guarda;
- hasta que pase una de esas dos cosas:
  - "Siguiente" no pasa de Fundamentación;
  - "3 · Fundamentación" queda marcado "falta";
  - "Imprimir" y "Exportar" se frenan con *"revisar la justificación del PAC: cambiaron
    las causas"*.

**d. Un archivo con justificación y sin `pac.causas`** (de la 34, la 35 o la 36) entra
**pidiendo la revisión**: un clic en "Sigue valiendo" alcanza.

**Test, por la pantalla:**

1. **Proceso 4 con el monto superado:**
   - se justifica y exporta;
   - el JSON trae `pac.causas` = `["monto"]`.
2. **Pasar a "No autorizado en el PAC":**
   - aparece el aviso, con el campo marcado;
   - "Siguiente" no pasa;
   - "3 · Fundamentación" dice "falta";
   - no imprime ni exporta, y el motivo dice "cambiaron las causas".
3. **"Sigue valiendo":** el aviso se va, exporta, y el JSON trae
   `pac.causas = ["fuera-del-pac"]`.
4. **Volver al proceso 4 y editar el texto:** el aviso se va sin apretar el botón.
5. **Importar `PRUEBAS-JEFE\r36-avance-justificado.json`** (copialo a `tests/fixtures/`):
   - pide la revisión;
   - con "Sigue valiendo", exporta.
6. **Sin causas:** sin campo, sin aviso, y exporta como hoy.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-37.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-37`.
4. **Paquete:** `node tools/empaquetar-generador.js --ronda 37 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-37.js` y las de las rondas 30 a 36.
**Escribí tu devolución en `PRUEBAS-JEFE\DEVOLUCION-RONDA-37.md`, no en esta orden.**

1. Imprimí. **¿El requerimiento dice "Lugar de entrega" con lo que escribiste, igual que la
   EETT?**
2. Justificá un monto superado y después cambiá a "No autorizado en el PAC". **¿Te avisa
   que cambiaron las causas y no te deja exportar?**
3. Apretá "Sigue valiendo", o corregí el texto. **¿Te deja seguir?**
