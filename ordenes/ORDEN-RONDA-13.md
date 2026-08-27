# ORDEN DE TRABAJO — RONDA 13

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hitos cubiertos: **correcciones del ciclo 12** · **H19 — Diálogo de sugerencias del piloto** · **H14 — Un proceso adjudicado como base de uno nuevo**
Emitida: 2026-08-26

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

El ciclo 12 salió bien en lo que importaba. **ADR-031 cerró el problema del YAML de raíz**: de los siete textos que rompían, los siete pasan; el auditor corrió cuarenta casos contra el parser real y falla uno solo, el byte nulo, que la especificación YAML prohíbe. Y **el registro de eventos quedó sólido**: catorce funciones, append-only, sin ninguna vía de reescritura, con los indicadores derivándose del archivo en vez de guardarse calculados. Eso era lo único que no se podía recuperar después.

### Y una cosa que no está bien, y va primero

**`INFORME-RONDA-12.md` perdió cuatro de las nueve secciones.** Faltan §4 (contradicciones e información faltante), §5 (qué NO hice), §6 (riesgos que veo) y §8 (accesos fuera del repositorio).

No es una formalidad. **Esas cuatro secciones son las que hacen que tu informe se pueda leer como si fuera cierto**, y son las que corrigieron mis propios errores tres veces:

- tu §5 del ciclo 9 —*"no toqué el wizard, es la pieza que falta para que el usuario final cargue los datos"*— fue lo que abrió la orden del ciclo 10;
- tu §4 del ciclo 10 declaró que mi orden se contradecía con H12 y ofreció la vuelta atrás en una línea;
- tu §4 del ciclo 11 declaró la discrepancia de las cotas y el `CAUSAL_OCA` dual.

Un informe sin ellas es un resumen de lo hecho. **Con ellas, es un informe.** Es lo único de este ciclo que quiero corregido sin excepciones.

### Accesos fuera del repositorio

`os.tmpdir()`, puertos locales `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

---

## 1. Alcance

Tres cosas, y dos son chicas:

1. **Las correcciones del ciclo 12**, incluida una de severidad alta.
2. **H19 — el diálogo de sugerencias.** Lo pidió el Jefe de Contrataciones y va ahora porque **hace falta ahora**: la evaluación del sistema ya empezó y no hay dónde anotar.
3. **H14 — usar un proceso adjudicado como base de uno nuevo.** Barato, porque el dato ya está guardado.

**Fuera de alcance:** las credenciales (H18, ronda 14) y las plantillas del pliego (H20, ronda 15).

---

## 2. Correcciones

### 2.1 — El CSV de eventos se puede volver una fórmula · **severidad alta**

`views/exploracion.js`, `exportarCSV()`: entrecomilla si el valor tiene coma, comilla o salto de línea, y nada más. Un campo que empieza con `=`, `+`, `-` o `@` **se ejecuta como fórmula al abrir el archivo en una planilla**. Y el registro de eventos está lleno de texto libre escrito por operadores: aclaraciones, motivos de devolución, observaciones.

**Es el mismo problema del YAML en otro formato, y se arregla con la misma forma:** no detectar los casos peligrosos — **neutralizar siempre**. Todo campo de texto que empiece con uno de esos caracteres (o con un tabulador) lleva un apóstrofo delante, sin excepción.

Y aplicá el criterio donde corresponda: **si hay otra exportación que produzca CSV, lleva la misma protección.** Buscala.

### 2.2 — Borrar `renders/pliego-bases-condiciones.js`

Verifiqué que `app/index.html` ya no lo carga, así que no es código vivo. Pero el archivo sigue declarando `estado: 'FIRMAS_PLIEGO_DISPOSICION'` y llamando a `firmaDom` y `pieDom`, y **ADR-030 dice que ese documento ya no es entregable**. Un archivo huérfano que declara un estado que no le toca es una trampa para el que lo lea en seis meses.

Se borra. `vista-previa-pliego.js` ya ocupa su lugar.

### 2.3 — El byte nulo en el emisor de YAML

`escapeDouble` maneja `\`, `"`, `\n`, `\t` y `\r`, pero no `\x00`. Sin consecuencia práctica —nadie escribe un byte nulo en un formulario— pero **el emisor tiene que producir YAML válido siempre**, que es el espíritu de ADR-031. Una línea.

### 2.4 — Una invariante nueva, y hay que fijarla con un test

El Jefe de Contrataciones aclaró el circuito real: **las especificaciones técnicas no llevan cantidades.** El anexo de EETT sólo describe qué es cada renglón; las cantidades —ciertas, o máximas cuando no se conocen con precisión— se cargan en el sistema **COMPRAR**, no en un documento que produzca esta aplicación.

Con eso **R17 se cierra** (enmienda a ADR-022 §3): la `cantidadMaxima` es un dato interno del requerimiento y del ANEXO 1, y nunca llega a un documento que obligue al proveedor por vía nuestra.

**Pero sólo mientras siga siendo cierto.** Un test que verifique que **el anexo de EETT no imprime cantidades** —ni solicitadas, ni máximas, ni mínimas—. Si algún día alguien las agrega, ese test tiene que ponerse en rojo.

---

## 3. H19 — El diálogo de sugerencias del piloto

Un panel flotante donde cualquiera que ayude a evaluar el sistema anota, en texto libre, lo que ve. **Un "chat con nadie":** nadie contesta, nadie recibe notificación, todo queda anotado.

- **Botón flotante siempre visible**, en cualquier pantalla. **No hace falta tener un expediente abierto.**
- **Cero fricción:** se abre, se escribe, se guarda. Sin categorías obligatorias, sin severidad, sin formulario. Si escribir una observación cuesta más de diez segundos, nadie la escribe.
- **Guarda el contexto solo**, y esto es lo que lo hace valer más que un cuaderno: operador, fecha y hora, pantalla en la que estaba, expediente y paso si había uno, versión de la aplicación y del catálogo, y navegador. *Una sugerencia que dice "esto es confuso" sin decir dónde no sirve dentro de dos semanas.*
- **Append-only y global**: `sugerencias.jsonl` en la carpeta de datos, no por expediente. Nunca se edita ni se borra: se **marca como atendida**.
- **Se activa con una marca de configuración `MODO_PILOTO`.** Fuera del piloto, el botón no existe. La marca **no se cambia desde la interfaz**.
- **Vista de lectura para el Jefe de Contrataciones**: lista, filtro por pantalla y por persona, marca de atendida, y **exportación a Markdown** para trabajarla con IA. Con la misma neutralización de §2.1 si la exportación es CSV.
- Entra en el respaldo (H3-8) y en la advertencia de datos sensibles: **son opiniones de personas identificadas**.

**Lo que no hace:** no notifica, no asigna, no tiene estados más allá de atendida o no, y no es un sistema de tickets. Si crece hacia eso, se convierte en trabajo administrativo y deja de usarse.

---

## 4. H14 — Un proceso adjudicado como base de uno nuevo

Leé **ADR-025** completa. Es lo más barato del roadmap porque **el dato ya está guardado**: el expediente perfeccionado conserva su `datos.json` íntegro en el Archivo Histórico.

- **Botón "Usar como base"** en la vista del Archivo Histórico, sobre expedientes perfeccionados.
- **Copia por lista blanca** de campos: renglones (código, descripción, unidad, cantidad, aclaración, máximos y mínimos), objeto, justificación de la necesidad, especificaciones técnicas, rubro comercial, modalidad y procedimiento sugeridos.
- **Nunca se copian**: número, fechas, estado, auditoría, registro de eventos, entregables, **presupuestos adjuntos**, **valores de referencia**, imputación, ni referencias a firmas.
- **Los precios nunca se heredan.** Un valor del año pasado que reaparece como referencia sin que nadie lo note es exactamente el defecto silencioso que la ronda 9 existió para evitar, entrando por la puerta de atrás. **El expediente nuevo nace sin presupuestos.**
- **Revalidación de códigos** contra la `catalogoVersion` vigente: un ítem que ya no existe **se marca y se pide reemplazo**, no se copia en silencio.
- El expediente nuevo registra **`basadoEn`** y lo muestra en pantalla, con su evento.
- **Pantalla de revisión antes de crear**: el usuario ve qué se copió y qué no, y puede desmarcar renglones.

**Lista blanca, siempre.** Una lista negra olvida un campo, y ese campo es el que hace daño.

---

## 5. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. Un campo que empieza con `=`, `+`, `-`, `@` o tabulador **sale neutralizado** en el CSV, en todas las exportaciones que produzcan CSV.
2. `renders/pliego-bases-condiciones.js` **no existe**, y nada lo referencia.
3. El emisor de YAML escapa el byte nulo y el archivo parsea.
4. **El anexo de EETT no imprime cantidades** — ni solicitadas, ni máximas, ni mínimas.
5. Con `MODO_PILOTO` apagado, **el botón de sugerencias no existe en el DOM**.
6. Una sugerencia guarda pantalla, expediente y paso **sin que el usuario los escriba**.
7. `sugerencias.jsonl` es append-only: veinte escrituras concurrentes, veinte líneas.
8. Una sugerencia se puede marcar atendida, **y no se puede editar ni borrar**.
9. "Usar como base" **no copia** presupuestos ni valores de referencia. Probalo con un expediente que los tenga.
10. Un código de catálogo dado de baja **se marca** al usar como base; no se copia en silencio.
11. El expediente nuevo registra `basadoEn` y su evento.
12. La suite completa termina en verde de una sola pasada.

---

## 6. `INFORME-RONDA-13.md` — **las nueve secciones**

Y nombro las cuatro que faltaron, para que no haya duda:

- **§4 · Contradicciones e información faltante** — dónde mi orden se contradice, dónde falta un dato, dónde tuviste que decidir por tu cuenta.
- **§5 · Qué NO hice** — lo que quedó fuera y por qué. Es la sección más útil de las nueve.
- **§6 · Riesgos que veo** — lo que funciona hoy y te preocupa igual.
- **§8 · Accesos fuera del repositorio** — todos, aunque sean los de siempre.

En la §2, explicá **cómo neutralizás el CSV** y **qué contexto captura una sugerencia**.

---

## 7. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. Documentación de sólo lectura: **ADR-021 a ADR-032**, las órdenes y `referencias/pliego/`.

```
node --test                      # verde, una sola pasada
node tools/check-compat.js       # salida 0
git add -A
git commit -m "Ronda 13 - Correcciones, H19 sugerencias y H14 reuso"
git push
git log --oneline -1             # tu commit tiene que estar
git status --short               # tiene que volver vacío
git log origin/main --oneline -1 # tiene que ser el MISMO commit
```

---

## 8. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en clon limpio, una sola pasada | Verde |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | Neutralización de fórmulas en CSV | **Siempre**, en toda exportación CSV |
| 4 | `pliego-bases-condiciones.js` | Borrado, sin referencias |
| 5 | Byte nulo en el YAML | Escapado; el archivo parsea |
| 6 | Anexo de EETT | **No imprime cantidades** (test) |
| 7 | `MODO_PILOTO` apagado | El botón de sugerencias no existe |
| 8 | Contexto de una sugerencia | Automático, sin que el usuario lo escriba |
| 9 | `sugerencias.jsonl` | Append-only; no se edita ni se borra |
| 10 | Usar como base | Sin presupuestos, sin valores de referencia, sin precios |
| 11 | Códigos dados de baja | Marcados, no copiados en silencio |
| 12 | `basadoEn` | Registrado y visible |
| 13 | Archivos sobre 400 líneas | Ninguno |
| 14 | **`INFORME-RONDA-13.md` con las nueve secciones** | **Completo, incluidas §4, §5, §6 y §8** |

---

## 9. Qué se está evaluando

Dos cosas chicas y una que no lo es.

**Que un texto de operador no pueda ejecutarse.** Es la tercera vez que aparece la misma forma de defecto: el YAML, el CSV, y antes la inyección en el HTML. La lección ya está escrita en ADR-031 y vale acá igual: **neutralizar todo, no adivinar cuáles.**

**Que anotar una observación cueste diez segundos.** El valor de H19 no está en la funcionalidad, está en la fricción. Si hay que elegir una categoría antes de escribir, nadie escribe.

**Y que el informe vuelva a tener nueve secciones.** Es lo único que no puedo verificar leyendo el código, y es de lo que depende que este sistema de trabajo siga funcionando.
