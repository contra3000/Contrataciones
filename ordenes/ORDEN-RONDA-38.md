# ORDEN DE TRABAJO — RONDA 38 · La justificación al cambiar de proceso, y la modalidad común u OCA

SGC · 2026-10-17 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: los dos primeros
ítems de la cola (`PLAN_DESARROLLO.md` §0.1, 17/10):

- el **24**, N2, con lo que se le sumó;
- el **3**, N3 del 02/10, que el Jefe volvió a pedir el 13/10.

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza: la suite completa en verde → commit con cuerpo** (qué cambió y qué test lo
  prueba) → `git push`. **Recién después empezás la siguiente.**
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/` no se toca;
  - sus tests no se modifican;
  - su requerimiento sale igual byte a byte, **salvo la línea de la causal de la OCA**
    (pieza 2c), y sólo en un expediente con OCA.
- **El informe describe cada test viejo que cambió**, uno por uno.

---

## Pieza 1 · La justificación del PAC se revisa también al cambiar de proceso

commit: `Ronda 38 · revisar la justificación al cambiar de proceso`

**a. La pregunta del auditor 37.** Las causas se comparan por tipo. Con una justificación
escrita para el proceso 4 (causa `monto`), al pasar al proceso 5, que también supera su
monto, no se pide revisar, y la justificación puede seguir nombrando el proceso 4.

**Lo que decidió el Jefe el 17/10:** cualquier cambio de proceso pide revisar.

- Junto con `pac.causas`, se guarda **`pac.procesoJustificado`**: el número de proceso, o
  `no-autorizado`, cuando se escribe o se confirma la justificación
  (`views/wizard.js:433-444`).
- Si el proceso de ahora no es ese, se pide revisar **igual que cuando cambian las
  causas**: el aviso, el campo marcado, el paso "falta", e "Imprimir" y "Exportar"
  frenados.
- **Un archivo con `pac.causas` y sin `pac.procesoJustificado`** (de la 37) toma el proceso
  de ahora: no pide revisar por eso.

**b. Lo que dejó la 37** (`PRUEBAS-JEFE\prueba-ronda-37.js`, paso 4, 11/12 sobre
`r37-cf5fa0d`).

- Después de "Sigue valiendo", el texto rojo *"Revisá la justificación del PAC: cambiaron
  las causas."* (`#sgc-error-pac-justificacion`) **sigue a la vista** hasta que se cambia de
  paso.
- La orden 37 pedía que el aviso se fuera. **Tiene que ocultarse en el momento**, con el
  botón o al editar el texto (`views/wizard.js:498-507` y `:629`).

**Test, por la pantalla:**

1. Proceso 4 con el monto superado, justificado → exporta. Pasar al proceso 5 con un
   preventivo que también lo supera:
   - aparece el aviso;
   - no exporta;
   - "Sigue valiendo" → exporta, y el JSON trae `pac.procesoJustificado: "5"`.
2. Después de "Sigue valiendo", **ningún texto de "cambiaron las causas" queda a la
   vista**, sin cambiar de paso. Lo mismo al editar el texto.
3. Un avance de la 37 con `pac.causas` y sin `pac.procesoJustificado` entra sin pedir
   revisión. Uno de la 36, sin `pac.causas`, la sigue pidiendo.

## Pieza 2 · La modalidad común u OCA

commit: `Ronda 38 · modalidad común u OCA`

**Lo que pidió el Jefe** (02/10, y de nuevo el 13/10): *"no estamos pidiendo la modalidad,
que de ser OCA pedirá la justificación de por qué se solicita OCA, guiando con lo que dice
la normativa de las razones que contempla para pedir Órdenes de Compra Abierta"*. Y
"Objetivo" sale.

**Cambia:**

**a. En "1 · Identificación"**, sólo en `generador.html` y después del PAC
(`generador.html:194-195`):

- `<select id="sgc-modalidad">` "Modalidad": una opción vacía, `comun` ("Común") y `oca`
  ("Orden de compra abierta (OCA)");
- **obligatorio, con la marca del generador**, como el trimestre: "Siguiente" no pasa, y un
  archivo viejo sin modalidad la pide antes de exportar.

**b. Con OCA:**

- **en "3 · Fundamentación"**, `#sgc-oca-justificacion` "Justificación de la OCA",
  **obligatoria**, con el mismo trato que la del PAC: el paso queda marcado "falta", y
  "Imprimir" y "Exportar" se frenan con *"justificar la modalidad orden de compra
  abierta"*. Arriba del campo va la guía de la norma:
  > *"La orden de compra abierta se usa cuando no se puede prefijar con suficiente
  > precisión la cantidad de unidades a adquirir o las fechas o plazos de entrega
  > (Decreto 1030/2016, art. 25 inc. c). Explicá por qué en este requerimiento no se
  > puede."*
- **en "2 · Renglones"**, cada renglón suma:
  - la **"Cantidad máxima por Solicitud de Provisión"**, obligatoria con OCA, con
    `aria-label="Cantidad máxima por Solicitud de Provisión"`;
  - la "Cantidad mínima", opcional, con `aria-label="Cantidad mínima"`.

  Valen las reglas del núcleo (`validarCantidades`, `core/requerimiento.js:186`).
- **el requerimiento** imprime, como ya sabe hacerlo con `ocaActiva()`
  (`core/requerimiento.js:279`, `renders/requerimiento.js:277-286`):
  - la justificación;
  - la tabla de máximos y mínimos;
  - la nota de la causal.

**c. La cita de la causal** (`renders/requerimiento.js:49-52`) dice hoy "Art. 25 inc. c)
del Decreto 1023/01 y Art. 111 del Decreto 1030/16". **Pasa a decir "Decreto 1030/2016,
art. 25 inc. c)"**, con el mismo texto de la guía. Es la única línea que puede cambiar en
la aplicación con servidor, y sólo en un expediente con OCA.

**d. "Objetivo" sale** de Fundamentación (`generador.html:336-337`).

- El JSON sigue llevando `objetivo: ""`, para que lo lean los archivos viejos.
- Si un archivo trae un objetivo, se importa y no se muestra.

**e. El JSON** lleva:

- `"modalidad": "comun" | "oca"`;
- `"ocaJustificacion"`;
- en cada renglón, `cantidadMaxima` y `cantidadMinima`.

El avance lo guarda y lo recupera. **La plantilla y sus instrucciones no cambian.**

**Test, por la pantalla:**

1. Sin modalidad, "Siguiente" no pasa de Identificación y deja el foco en `#sgc-modalidad`.
2. **Con "Común":** no aparece la justificación de la OCA ni las cantidades máximas, y
   exporta como hoy.
3. **Con OCA, sin justificación:**
   - "3 · Fundamentación" dice "falta";
   - el campo muestra la guía con "Decreto 1030/2016, art. 25 inc. c";
   - no imprime ni exporta.
4. **Con OCA y sin cantidad máxima** en un renglón: no exporta, y el motivo nombra el
   renglón.
5. **Con OCA completa:**
   - el requerimiento trae la justificación, la tabla con la cantidad máxima y la nota
     con "Decreto 1030/2016";
   - **no dice "1023/01" ni "Art. 111"**;
   - el JSON trae `modalidad: "oca"`, `ocaJustificacion` y `cantidadMaxima`.
6. En "3 · Fundamentación" ya no hay `#sgc-objetivo`.
7. Un avance de la 37, sin `modalidad`, pide la modalidad antes de exportar.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-38.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-38`.
4. **Paquete:** `node tools/empaquetar-generador.js --ronda 38 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-38.js` y las de las rondas 30 a 37.
**Escribí tu devolución en `PRUEBAS-JEFE\DEVOLUCION-RONDA-38.md`, no en esta orden.**

1. Justificá un monto superado y cambiá a otro proceso que también lo supere. **¿Te pide
   revisarla? Con "Sigue valiendo", ¿desaparece el aviso en el momento?**
2. Elegí "Orden de compra abierta". **¿Te pide la justificación con la guía de la norma, y
   la cantidad máxima de cada renglón?**
3. Imprimí. **¿La causal cita bien la norma? Revisá vos el texto:** el revisor no pudo
   confirmar la cita contra el texto oficial del decreto.
4. **¿"Objetivo" ya no está?**
