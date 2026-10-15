# ORDEN DE TRABAJO — RONDA 36 · La justificación del PAC en Fundamentación, y el requerimiento sin "Lugar"

SGC · 2026-10-15 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: los dos primeros
ítems de la cola (`PLAN_DESARROLLO.md` §0.1, 15/10), el 17 (con el 18 sumado) y el 21, los
dos N2, con las decisiones del Jefe del 15/10. **El piloto usa `r34-187a184`.**

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza: la suite completa en verde → commit con cuerpo** (qué cambió y qué test lo
  prueba) → `git push`. **Recién después empezás la siguiente.**
  - **En la 35, la pieza 1 se commiteó sin correr la suite completa:** dejó 25 tests viejos
    en rojo, que se arreglaron una hora después (`30c6c32`). Se declaró bien, pero **no
    vuelve a pasar**.
  - Antes de cada commit de pieza, `node --test --test-timeout=120000 "tests/*.test.js"`
    entero, y el informe pega esa corrida.
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/` no se toca;
  - sus tests no se modifican;
  - el requerimiento de un expediente suyo sale **igual byte a byte**.
- **El informe describe cada test viejo que cambió**, uno por uno. En la 35 faltó
  `ronda-34-p1.test.js`.

---

## Pieza 1 · La justificación del PAC, en Fundamentación y por tres causas

commit: `Ronda 36 · justificación del PAC en Fundamentación`

**Lo que vio el Jefe en la 35:**

- *"La 'Justificación del PAC' aparece en '1 · Identificación' después de que lleno cosas
  de '2 · Renglones', y nunca me avisa que el campo está incompleto."*
- Medido con `PRUEBAS-JEFE\probe-pasos.js`: con el preventivo por encima del monto, sólo
  queda marcado "4 · Revisión · falta". La causa es que los faltantes del PAC entran en
  `items` pero no en `faltantes.campos`, que es lo que lee `pasosPendientes()`
  (`generador.js:360-386`).
- **Y el año no se cruza con el PAC.** Con el año 2027 y un proceso del PAC 2026, el
  requerimiento dice "PAC 2026" y "Vigencia 30/09/2027", y nada lo pide justificar.

**Lo que decidió el Jefe el 15/10:** todo va a un solo campo, **en "3 · Fundamentación"**,
que explica qué hay que justificar y es obligatorio cuando aparece.

**Cambia:**

**a. El campo pasa de Identificación a Fundamentación.**

- `#sgc-pac-justificacion` y su contenedor (`generador.html:201-204`) se mudan a
  `#sgc-paso-fundamentacion`, después de "Justificación del requerimiento"
  (`generador.html:316-317`). **Se queda con el mismo id**, y el JSON sigue en
  `pac.justificacion`.
- En "1 · Identificación" ya no hay justificación del PAC.

**b. Aparece cuando hay al menos una de estas causas:**

| Causa | Cuándo |
|---|---|
| Fuera del PAC | Se eligió "No autorizado en el PAC", como hoy |
| Año | El año del requerimiento **no es** el `anio` de `config/pac.json` (2026) |
| Trimestre | El trimestre elegido **no es** el del proceso |
| Monto | El preventivo, en ARS o en USD, **supera** el monto del proceso, como hoy (`itemsDelPac`, `generador/documentos.js:129`) |

**c. Arriba del campo, un texto que dice qué hay que justificar**, una línea por cada causa
que se cumple, con los datos. Por ejemplo:

- *"El preventivo ($ 106.000.369,00) supera el monto del proceso 32 del PAC
  ($ 762.637,50)."*
- *"Se pide para el 4° trimestre y el PAC prevé el proceso 32 para el 3°."*
- *"El requerimiento es del año 2027 y el PAC es de 2026."*
- *"El pedido no está autorizado en el PAC."*

**d. Es obligatorio cuando aparece:**

- **"Siguiente"** no pasa de Fundamentación sin justificación, y deja el foco en
  `#sgc-pac-justificacion` con `campo-con-error`;
- **el paso "3 · Fundamentación" queda marcado "· falta"**. El faltante del PAC tiene que
  llegar a `pasosPendientes()` como un campo de Fundamentación;
- **"Imprimir" y "Exportar"** siguen frenados, con un motivo que nombra la causa.

**e. Si la causa desaparece**, por ejemplo porque se corrige el trimestre, el campo se
oculta. **No se borra lo escrito.** Hoy `views/wizard.js:453-454` lo borra, y eso cambia:
lo escrito se conserva, pero sólo se imprime y se exporta mientras haya causa.

**f. El requerimiento impreso** sigue con "Justificación del PAC" (`renders/requerimiento.js:131`).

**Test, por la pantalla:**

1. En Identificación no hay `#sgc-pac-justificacion` a la vista.
2. **Monto:** proceso 4 con un preventivo de $ 2.000.000:
   - en Fundamentación aparece el campo, con el texto que nombra el monto del proceso 4;
   - "Siguiente" sin justificación no pasa, deja el foco en el campo marcado, y "3 ·
     Fundamentación" dice "falta".
3. Con la justificación cargada, "Siguiente" pasa, imprime, exporta, y el requerimiento
   dice "Justificación del PAC".
4. **Trimestre:** proceso 3 (1° trimestre), trimestre cambiado a 2 y un preventivo bajo →
   el campo aparece, el texto nombra los dos trimestres, y no exporta sin él.
5. **Año:** año 2027 con el proceso 1 y un preventivo bajo → el campo aparece, el texto dice
   2027 y 2026, y no exporta sin él.
6. **Sin causas** (proceso 1, 1° trimestre, 2026, preventivo bajo) → el campo no aparece y
   exporta.
7. Escribir la justificación con el trimestre cambiado, volver el trimestre al del PAC → el
   campo se oculta; volver a cambiarlo → **reaparece con lo escrito**.

## Pieza 2 · El requerimiento sin "Lugar"

commit: `Ronda 36 · requerimiento sin Lugar`

**La pregunta del auditor 35:** el requerimiento decía "Lugar: VII Brigada Aérea - Moreno",
fijo, y la EETT el lugar de entrega que escribe la persona. **Los dos papeles podían decir
lugares distintos.**

**Lo que decidió el Jefe el 15/10:** el requerimiento **deja de mostrar "Lugar"**. El lugar
de entrega queda sólo en la EETT.

**Cambia:**

- En el generador, el requerimiento no lleva "Lugar". `expedienteLocal()` deja de poner la
  constante (`generador/documentos.js:188`).
- **La constante sale:** `lugarEntrega` de `config/aplicacion.json:6`, y
  `lugarEntrega()` de `generador/documentos.js:54`. Después, `node tools/build-config.js`.
- **La EETT sigue con "Lugar de entrega"** = lo que escribió la persona.
- **La aplicación con servidor no cambia:** su requerimiento sigue con "Lugar" desde sus
  datos, igual byte a byte.

**Test, por la pantalla:**

1. Con el lugar de entrega "Depósito de Intendencia, Hangar 3":
   - el requerimiento impreso no tiene la fila "Lugar";
   - la EETT dice "Lugar de entrega: Depósito de Intendencia, Hangar 3";
   - **en ningún documento aparece "VII Brigada Aérea - Moreno"**.
2. `build-config --verificar` en verde, y el paquete sin `lugarEntrega` en
   `config/aplicacion.js`.
3. El requerimiento de la aplicación con servidor, igual byte a byte que en `135e59a`.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-36.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-36`.
4. **Paquete:** `node tools/empaquetar-generador.js --ronda 36 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-36.js` y las de las rondas 30, 31, 33,
34 y 35. **Escribí tu devolución en `PRUEBAS-JEFE\DEVOLUCION-RONDA-36.md`, no en esta orden.**

1. Repetí tu caso: el proceso 32 con un preventivo que lo supera. **¿La justificación del
   PAC aparece en "3 · Fundamentación", dice qué tenés que justificar, y el paso queda
   marcado "falta" hasta que la escribís?**
2. Elegí un trimestre distinto del que tiene el proceso en el PAC. **¿Te la pide, y dice
   por qué?**
3. Poné el año 2027 con un proceso del PAC 2026. **¿Te la pide?**
4. Imprimí. **¿El requerimiento ya no tiene "Lugar", y la EETT dice el lugar de entrega
   que escribiste?**
