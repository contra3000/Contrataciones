# ORDEN DE TRABAJO — RONDA 11

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H13 — ANEXO 1 y salida hacia el pliego**
Emitida: 2026-08-21

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

El ciclo 10 quedó **aprobado en segunda pasada**, con los cuatro hallazgos cerrados y ningún defecto nuevo de severidad alta ni media. **H11 y H12 terminados**: desde ayer un operador puede cargar un requerimiento real de principio a fin desde la pantalla.

Tres cosas de tu trabajo que quiero nombrar, porque no las pidió nadie:

1. **Encontraste el desbalance del conteo de caracteres y lo arreglaste entero.** Yo sólo había sospechado que había "un `length` en cada lugar". La realidad era peor: la regla de desborde contaba puntos de código y los otros cuatro sitios contaban unidades UTF-16, así que una aclaración con suficientes emojis podía pasar el validador y desbordar igual. Lo unificaste en una sola función, lo fijaste por test y declaraste la limitación que queda (el `maxLength` del navegador es UTF-16). Eso es cerrar un problema, no una tarea.
2. **Declaraste la contradicción de mi orden en vez de obedecerla.** Yo pedía rechazar una aclaración de 300 caracteres; con H12, 300 caracteres van al anexo. Cumplir literalmente hubiera significado que H12 no existiera. Lo pusiste en §4 con las dos lecturas, las respuestas reales y la vuelta atrás de una línea por si yo prefería la mía. Es exactamente lo que hay que hacer con una orden mal escrita.
3. **Partiste el servidor y la pantalla por responsabilidad, no por tamaño.** `presupuestos.js` salió a su propio archivo porque es otro endpoint, no porque `expedientes.js` llegaba a 428 líneas.

### Lo que el auditor dejó abierto, y es lo primero de esta ronda

Fue a cazar el **patrón** que causó el defecto grave del ciclo 10, no la instancia. Lo encontró vivo en tres lugares. Ver §2.1: es la corrección más importante de esta ronda y ahora tiene su propia ADR.

### Accesos fuera del repositorio · **leé esto antes de empezar**

Esta ronda tiene **un acceso autorizado nuevo**, y es la única vez que aparece:

```
C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\
```

- **Sólo lectura** para leer las plantillas, los scripts y los datos de ejemplo.
- Podés **ejecutar** `scripts/generar_pliego.py` para verificar tu YAML, **con la salida dirigida a una carpeta temporal**.
- **No escribas absolutamente nada dentro de esa carpeta**, ni en `salidas/`, ni en `datos/`. Es documentación real de la División, no un banco de pruebas.

Los tres YAML de ejemplo ya están copiados dentro de tu repositorio, en `referencias/pliego/`. **Ese es el contrato**; la carpeta de afuera es sólo para correr el generador de verdad.

Además, lo de siempre: `os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Alcance

El **ANEXO 1** —lo que Abastecimiento eleva a la UOC— y el **YAML que alimenta el generador de pliegos que ya existe**.

Con esto se cierra la cadena documental: el usuario carga el requerimiento, Abastecimiento completa el ANEXO 1 precargado con lo que ya está, y de la suma de los dos sale el archivo que produce el pliego **sin que nadie transcriba nada a mano**.

**Fuera de alcance:** los estilos (final del roadmap), las Disposiciones de Autorización y Adjudicación (no tienen plantilla todavía), y la carga de la imputación por Contaduría.

---

## 2. Correcciones arrastradas

### 2.1 — Las guardias silenciosas · **ADR-029, y es lo primero**

Leé **ADR-029** completa antes de tocar esto.

El defecto grave del ciclo 10 no fue una validación olvidada: fue una validación que **una guardia defensiva apagaba sin decir nada**, escrita por conveniencia para que unos tests no rompieran. Sobrevivió dos ciclos con la suite entera en verde, porque **es inmune a los tests: el `if` existe justamente para que los tests pasen.**

El patrón sigue vivo en tres lugares:

```
app/js/core/validacion.js:122        if (SGC.core.requerimiento) { ... }
app/js/core/validacion.js:133        if (SGC.core.requerimiento) { ... }
app/js/renders/requerimiento.js:115  if (SGC.core.anexoEett && ...)
```

La tercera es la más engañosa: si faltara `anexo-eett.js`, el documento imprimiría el texto completo en lugar de `"según anexo alfa"`, y saldría un papel plausible y mal.

- **Pasan al patrón de lanzamiento que ya existe en `repo.memoria.js`**: exigir la dependencia y lanzar diciendo qué falta y quién lo pedía. No inventes otro; copiá el que está bien.
- **Un test que necesita el módulo, carga el módulo.** Si algún test dependía de la conveniencia que se elimina, arreglá el test.
- **Test de integridad del núcleo**: arranca el servidor y verifica que todos los módulos declarados estén cargados. Y —esto es lo que lo hace valer— **verificá que ese test falle** si sacás un módulo de la lista. Un test de integridad que pasa siempre no prueba nada.
- Declará el orden de carga de `server/servidor.js` y de `app/index.html` con un comentario que diga **por qué** ese orden.

### 2.2 — Se puede avanzar con un anexo que no existe

Si un renglón desborda, el requerimiento impreso dice `"según anexo alfa"`. Pero el anexo no es entregable obligatorio de ningún estado, así que **el expediente avanza sin haberlo generado** y se puede firmar un documento que cita un anexo inexistente.

No hay pérdida de datos y el anexo es regenerable. Aun así: **cuando haya referencias pendientes, el anexo pasa a ser entregable obligatorio.** Del lado del servidor, como todo lo demás.

### 2.3 — Menores

- La **causal normativa de OCA** (Art. 25 inc. c) Dec. 1023/01 y Art. 111 Dec. 1030/16) está en el documento impreso pero **no en la pantalla**, que es donde la pedí: es ahí donde el usuario tiene que saber contra qué justifica.
- **Cota propia** para los catorce campos del encabezado que hoy sólo acota el límite de 4 MB del cuerpo. Elegí números razonables, ponelos en `config.js` y documentalos.
- Comentario vencido en `app/js/views/fasttrack.js:9`: sigue diciendo "más de 200 caracteres se rechazan".

---

## 3. Entregables

### 3.1 — El formulario de ANEXO 1

Para el rol **abastecimiento**, en el estado que corresponde de su fase.

Las catorce secciones, según `ANALISIS_ENTREGABLES_REALES.md` §3.3. Lo importante es qué se **precarga** y qué se **pregunta**:

| § | Contenido | De dónde sale |
|---|---|---|
| 1 y 1.1 | Objeto y justificación de la necesidad | **Precargado del requerimiento** |
| 2 | Precio de referencia: empresas consultadas | **Derivado de los presupuestos** que cargó el usuario |
| 2.1 | Justificación de moneda extranjera | Abastecimiento, condicional |
| 3 y 3.1 | PAC: previsto o no, N° de orden, trimestre | Abastecimiento |
| 4 | Unidad requirente: responsable, usuario GDE, dirección, teléfono, correo, lugar de entrega y de facturación | **Precargado** salvo el usuario GDE |
| 5 | Comisión de recepción: 3 titulares y 3 suplentes, con el N° de orden del día | Abastecimiento, texto libre |
| 6 | Personal técnico que analiza ofertas (hasta 2): nombre, usuario GDE, correo | Abastecimiento |
| 7 | Requisitos mínimos | Abastecimiento — **es la sección que alimenta el pliego, ver §3.3** |
| 8 | Visita o muestra patrón | Abastecimiento, condicional |
| 9 a 12 | Casos especiales: interadministrativas, bienes de uso (BIM/BAPIN/PIDEF), hardware/software (ONTI/ETAP), reparaciones de infraestructura | Abastecimiento, **condicionales** |
| 13 | Documentación obligatoria del oferente | Abastecimiento |
| 14 | Criterio de evaluación / fórmula polinómica | Abastecimiento |

**Las secciones 9 a 12 son bloques condicionales**, no catorce secciones siempre visibles con "NO CORRESPONDE" repetido. Se muestran cuando el tipo de contratación lo pide, y en el documento impreso aparecen sólo las que corresponden.

**Sobre la precarga, una regla:** lo precargado es **editable pero trazable**. Si Abastecimiento cambia el objeto que escribió el usuario, eso es un dato —no un error— y tiene que quedar registrado como evento (adelanta ADR-024). Un ANEXO 1 que contradice al requerimiento sin que nadie se entere es un problema de expediente.

**El precio de referencia (§2) sale de los presupuestos**: las empresas consultadas son las que emitieron los presupuestos adjuntos, y el monto es el preventivo que ya calculamos. No se vuelve a tipear.

### 3.2 — La planilla de OCA · **acá vive un riesgo legal, R17**

Cuando la modalidad es Orden de Compra Abierta, la planilla `Renglón | Cant. solicitada | U.M. | Cant. máxima`, con las cantidades del requerimiento.

**Y ahora hay que resolver lo que ADR-022 §3 dejó anotado.** En la División, `cantidadMaxima` significa *el tope que se le puede requerir al proveedor en una sola Solicitud de Provisión*. El Art. 112 del Decreto 1030/16 dice otra cosa:

> *"...el número máximo de unidades que podrán requerirse **durante el lapso de vigencia del contrato**... El cocontratante estará obligado a proveer hasta el máximo de unidades determinadas en dicho pliego."*

**El pliego es un documento legal.** Si la planilla se rotula "Cantidad máxima" a secas y se completa con un valor por entrega, el documento obliga al proveedor a mucho menos de lo necesario — y en contra del organismo.

La regla para esta ronda: **la columna se rotula con el significado que realmente tiene.** `"Cantidad máxima por Solicitud de Provisión"`, o el texto que uses, pero explícito. Y si tenés una forma razonable de **derivar además el máximo contractual** (por ejemplo, cantidad solicitada para el lapso del contrato), proponela en el informe — no la implementes sin que yo la vea.

Esto no se resuelve con código, se resuelve con una etiqueta correcta. Es la corrección más barata y la de mayor consecuencia de la ronda.

### 3.3 — La exportación del YAML

El generador de pliegos ya funciona. **No lo rehacemos: le damos de comer.**

El contrato está en `referencias/pliego/EJEMPLO_DATOS.yaml` (bienes) y `EJEMPLO_DATOS_SERVICIOS.yaml` (servicios). De dónde sale cada campo:

| Campo del YAML | Origen |
|---|---|
| `tipo_documento`, `version` | Elección de Abastecimiento; `"proyecto"` por defecto |
| `tipo_contrato` | `"bienes"` / `"servicios"` — derivable del rubro, confirmable a mano |
| `tipo_procedimiento`, `clase_modalidad` | Requerimiento (procedimiento y modalidad sugeridos) |
| `nro_procedimiento`, `ejercicio` | Del expediente |
| `tipo_oc` | ANEXO 1 §7 (modalidad OCA) |
| `nro_expediente_gde` | **No lo tenemos**: es del sistema GDE. Campo de carga manual en el ANEXO 1 |
| `rubros`, `nombre_proceso`, `objeto` | Requerimiento |
| `organismos_requirentes[]` (nombre, domicilio, teléfono, correo, horario, `frecuencia_provision`, `plazo_entrega`) | ANEXO 1 §4 y §7. **Admite de uno a tres**; modelalo como lista desde el principio |
| `ofertas_parciales`, `ofertas_alternativas`, `duracion_contrato` | ANEXO 1 §7 |
| `apendice_eett` | El anexo de EETT que produce H12 |
| `apendices_opcionales[]` (nombre, clave, archivo) | Abastecimiento |

**Cómo se emite, y es la parte delicada:** cero dependencias sigue valiendo (ADR-003), así que **no hay librería de YAML**. Escribí un emisor para *exactamente esta forma* —escalares, listas de mapas, dos niveles— y hacelo bien en lo único que suele fallar: **el escapado y el entrecomillado**. Mirá el ejemplo: `rubros` viene con comillas dobles adentro de comillas simples, y los textos traen acentos, paréntesis, porcentajes y dos puntos. **Un dos puntos sin entrecomillar rompe el YAML en silencio y el pliego sale mal o no sale.**

- Probá con textos que contengan `: `, `#`, `-` al principio, comillas simples y dobles, saltos de línea y acentos.
- Emití **de uno a tres organismos requirentes**, no sólo uno.
- Los campos que no tenemos se emiten **vacíos y visibles**, nunca inventados. Un YAML con un `nro_expediente_gde` inventado es peor que uno con el campo en blanco.

**Verificación exigida, y es el criterio de aceptación real:** tomá el YAML que emite la aplicación para un expediente de prueba completo y **corré el generador de verdad** con él (§0: sólo lectura, salida a carpeta temporal). Si el pliego sale sin edición manual, H13 está. Si no sale, decime exactamente qué campo lo rompió.

### 3.4 — La plantilla impresa del ANEXO 1

Reutilizando `renders/documento.js`, con las dos leyendas en el pie como todo lo demás. Sólo las secciones que corresponden; los bloques condicionales no elegidos no se imprimen.

---

## 4. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. Las tres guardias silenciosas **lanzan** cuando falta la dependencia (ADR-029).
2. El test de integridad del núcleo **falla** si se saca un módulo de la lista de carga.
3. Un renglón desbordado sin anexo generado **no deja avanzar de estado**, verificado contra el servidor.
4. El ANEXO 1 precarga objeto, justificación, datos de la unidad y cantidades desde el requerimiento.
5. Una edición de un campo precargado queda registrada como cambio respecto del requerimiento.
6. Las secciones 9 a 12 no aparecen en el documento cuando no corresponden.
7. El precio de referencia (§2) sale de los presupuestos cargados, no de una carga manual.
8. La planilla de OCA rotula la columna con su significado real.
9. El YAML emitido **parsea**, y con uno, dos y tres organismos requirentes.
10. El YAML sobrevive a textos con `: `, `#`, comillas simples y dobles, acentos y saltos de línea.
11. Los campos sin dato salen vacíos, nunca inventados.
12. La suite completa termina en verde de una sola pasada.

---

## 5. `INFORME-RONDA-11.md`

Las nueve secciones. En la §2, tres cosas explícitas:

- **cómo quedó el patrón de dependencias** (ADR-029) y si algún test dependía de la conveniencia eliminada;
- **cómo entrecomillás y escapás** en el emisor de YAML, y qué casos probaste;
- **qué campos del YAML no podemos llenar** y qué pasa con ellos aguas abajo.

Y en la §3, **el resultado de correr el generador real** con tu YAML: salió o no salió, y si no, qué campo lo rompió.

---

## 6. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. La documentación es de sólo lectura: **ADR-021 a ADR-029 y las órdenes las escribí yo, no las toques.** `referencias/pliego/` también es sólo lectura: es el contrato, no un borrador.

Cierre, y **el cierre es parte del entregable**:

```
node --test                      # verde, una sola pasada
node tools/check-compat.js       # salida 0
git add -A
git commit -m "Ronda 11 - H13 ANEXO 1 y salida hacia el pliego"
git push
git log --oneline -1             # tu commit tiene que estar
git status --short               # tiene que volver vacío
```

**No des la ronda por terminada hasta que esos dos últimos comandos den lo que corresponde.** Trabajo que no está publicado vale exactamente lo mismo que trabajo que no se hizo — nos costó un ciclo entero aprenderlo.

---

## 7. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en clon limpio, de una sola pasada | Todo en verde |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | Guardias silenciosas (ADR-029) | Las tres lanzan; ninguna saltea una regla |
| 4 | Test de integridad del núcleo | Existe **y falla** si se quita un módulo |
| 5 | Anexo obligatorio con referencias pendientes | No se puede avanzar sin generarlo |
| 6 | ANEXO 1: catorce secciones, 9 a 12 condicionales | Las que no corresponden no se imprimen |
| 7 | Precarga desde el requerimiento | Objeto, justificación, unidad y cantidades |
| 8 | Precio de referencia | Derivado de los presupuestos |
| 9 | Planilla de OCA | Columna rotulada con su significado real (R17) |
| 10 | YAML emitido | Parsea, con 1 a 3 organismos, y sobrevive a textos hostiles |
| 11 | **El generador real produce el pliego con ese YAML** | **Sin edición manual** |
| 12 | Campos sin dato | Vacíos y visibles, nunca inventados |
| 13 | Causal de OCA en pantalla | Presente junto al campo de justificación |
| 14 | Archivos sobre 400 líneas | Ninguno |
| 15 | `INFORME-RONDA-11.md` con sus 9 secciones | Completo |

---

## 8. Qué se está evaluando

Que la cadena documental cierre: **que del requerimiento y el ANEXO 1 salga el pliego sin que nadie transcriba nada.**

Pesa, en este orden: (1) que el generador real produzca el pliego con nuestro YAML, (2) las guardias de ADR-029, (3) el rótulo de la planilla de OCA, (4) la precarga, (5) los bloques condicionales.

El punto 1 va primero porque es el único que **no se puede aprobar por inspección**: o el pliego sale, o no sale. Y el punto 3 va tercero pese a ser una etiqueta, porque es el único de la lista cuyo error se paga en un contrato firmado con un proveedor.
