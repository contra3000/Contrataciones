# ORDEN DE TRABAJO — RONDA 5

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H5 — Wizard de Fase 1 (primera interfaz completa)**
Emitida: 2026-08-14

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

Tu trabajo del ciclo anterior fue auditado. El reporte no está en el repositorio, pero sus hallazgos están en la §2 de esta orden, que es obligatoria y va primero.

### Accesos fuera del repositorio

Exactamente dos, ninguno más:

1. **`os.tmpdir()`** — archivos temporales de test.
2. **Puertos locales** (`127.0.0.1`) — para levantar el servidor y probar la pantalla.

Si necesitás algo fuera de esta lista, **detenete y anotalo en el informe** en vez de insistir.

---

## 1. Alcance

Este es el hito que justifica el proyecto entero. El FSD abre diciendo que el problema a resolver es la mala calidad de los datos de entrada; acá se resuelve.

Un usuario generador entra, completa una Especificación Técnica paso a paso con validación estricta, carga sus renglones desde el catálogo, y el expediente queda guardado en el servidor con su número asignado y su auditoría. **De punta a punta, en el navegador.**

**Fuera de alcance:** la generación del entregable imprimible y el PDF (ciclo 6), el tablero Kanban, y las fases 2 a 10. Acá sólo se cubre el paso 1 de los 18.

---

## 2. Correcciones arrastradas (obligatorias, van primero)

### 2.1 — Los tramos de coincidencia están mal · **condición de entrada**

`indice.montar` normaliza y busca sobre el texto combinado `rubro + ' ' + clase`, y guarda los tramos contra **ese** texto. La pantalla los aplica a `resultado.clase` sola. Resultado medido sobre el catálogo real: de 17 resultados muestreados, **13 tramos caen fuera del rango de la clase** y 4 resaltan texto equivocado.

```
valvula    -> tramo [25,7] sobre "VALVULAS P/ELECTRONICA" (largo 22)  → fuera de rango
termostato -> resalta "S P/CALEFA" en "TERMOSTATOS P/CALEFACTORES"    → texto equivocado
cable      -> resalta "UCTUR" en "CABLEADO ESTRUCTURADO"              → texto equivocado
```

Corregilo como corresponda —devolver los tramos referidos al texto que la interfaz muestra, o devolver por separado los del rubro y los de la clase— pero **el contrato tiene que quedar explícito en el código**: contra qué cadena son válidos los índices.

Y arreglá también **el test que dejó pasar esto**. `tests/…` valida el tramo contra el texto combinado, o sea contra el mismo supuesto que produjo el error. El test nuevo tiene que validar contra `resultado.clase`, que es lo que el usuario ve. Un test que hereda el supuesto del código no prueba nada.

### 2.2 — El build no es reproducible desde un clon · **corrección del revisor**

Los tests de `tools/build-catalogo.js` dependen de `datos-prueba/catalogo_incisos.json`, que está —correctamente— en `.gitignore`. Desde un clon limpio, esos cuatro tests fallan y el generador no corre. La instrucción de poner el catálogo ahí fue mía y estaba mal.

Commitear 40 MB no es la solución. Hacé esto:

1. Generá **`tests/fixtures/catalogo-muestra.json`**: unos 500 registros reales tomados del catálogo completo, cubriendo al menos cinco rubros distintos, alguna clase con acentos y alguna clase grande. Se versiona.
2. Los tests del build corren **contra el fixture**. Deben pasar en un clon recién hecho, sin ningún archivo externo.
3. Un test aparte, para la verificación de las 159.366 filas contra el catálogo completo, que **se saltea con un aviso legible** si el archivo no está presente. No debe fallar: debe informar que se salteó y por qué.

Verificalo de verdad: cloná tu propio repositorio a una carpeta temporal y corré `node --test` ahí. Si algo se pone en rojo, no está terminado.

### 2.3 — Escape en el desplegable de ítems

`tecladoItems` (`buscador.js:404-417`) atiende flechas y Enter pero no `Escape`, así que con el desplegable de ítems abierto Escape no lo cierra. `tecladoClases` sí lo maneja. Unificá el comportamiento.

### 2.4 — Entrada corrupta en el generador

`JSON.parse` en `tools/build-catalogo.js:128` no está protegido: ante un archivo vacío, truncado o que no es JSON, el proceso escupe un stack trace. Envolvelo y dale un mensaje que diga qué archivo y qué le pasa.

### 2.5 — Referencia muerta al esquema v1

`app/js/adapters/repo.js:185` conserva `|| (expediente && expediente.estadoActual)`. Tras ADR-019 todos los documentos son v2 y esa rama es código muerto que cita la forma vieja. Borrala.

### 2.6 — Sobre ADR-020 y la documentación

Agregaste **ADR-020** a `BITACORA_DECISIONES.md`. Ese archivo es de **sólo lectura** por la regla 1 de conducta, en todas las órdenes desde la ronda 1.

**La decisión queda vigente**: el análisis es correcto —681 KB contra un presupuesto de 300, resuelto en 252— y con la medición al lado. No hay nada que revertir.

Lo que corrijo es el procedimiento, que es el mismo que ADR-019 dejó escrito en el ciclo anterior: **una desviación de un contrato dictado se propone antes de implementarla.** El camino era describir el problema y la solución en la sección 2 de tu informe; la ADR la escribe el revisor. De acá en adelante, ninguna edición de la documentación, ni siquiera para agregar algo correcto.

---

## 3. Entregables nuevos — el wizard

### 3.1 — `app/js/views/wizard.js`

Un asistente por pasos para la Especificación Técnica. Como mínimo cuatro pasos, con validación estricta antes de permitir avanzar al siguiente:

1. **Identificación** — título del requerimiento, año, dependencia solicitante, operador (desde el padrón `config/usuarios.ejemplo.json`, ADR-017).
2. **Renglones** — el buscador del ciclo 4, ya integrado: elegir ítems del catálogo, con cantidad, unidad y la aclaración opcional de 200 caracteres.
3. **Fundamentación** — los campos de texto que justifican el requerimiento.
4. **Revisión y confirmación** — todo lo cargado a la vista, en modo lectura, con un botón que persiste.

Reglas:

- **La validación es la de `SGC.core.validacion`**, la que existe desde la ronda 2. No escribas validadores nuevos en la vista.
- No se puede avanzar de paso con el paso actual inválido, y el motivo tiene que estar a la vista, junto al campo, en español.
- Se puede retroceder sin perder lo cargado.
- **Navegación completa por teclado** y `aria-*` correctos, incluido el anuncio de los errores de validación.
- Chrome 109 es el techo. Tu guardián te lo dice.

### 3.2 — Borrador local

La Fase 1 admite guardado local antes de persistir en la red (FSD §5, `InstruccionesCodigo.md` §11.2).

- El borrador vive en `sessionStorage` y **sobrevive a un cierre accidental de la pestaña**.
- Al volver a entrar, si hay un borrador, la aplicación ofrece retomarlo o descartarlo. Nunca lo aplica en silencio.
- Al persistir con éxito, el borrador se limpia.
- El borrador guarda el correo del operador: si entra otro, **no se le ofrece el borrador ajeno**.

### 3.3 — Persistencia real

El botón final del paso 4 llama a `SGC.adapters.repo.crearExpediente`, que ya existe. El expediente queda en el servidor con su número asignado, su entrada en el índice fragmentado y su primera entrada de auditoría.

- El expediente creado registra `catalogoVersion` (ADR-014).
- El estado inicial es `ESPECIFICACIONES_TECNICAS` y la auditoría registra la creación con el correo del operador.
- Si el servidor falla o la carpeta de datos está inaccesible, **el borrador no se pierde** y el usuario ve un mensaje legible, no una excepción.

### 3.4 — Fast-Track: importar un JSON modelo

FSD §5. El usuario puede descargar un JSON de ejemplo, completarlo por fuera y subirlo para pre-poblar el wizard.

**Tratá ese archivo como entrada no confiable.** Puede haber sido generado por una herramienta de IA externa. Antes de tocar el formulario:

- Verificá estructura y tipos, campo por campo.
- Verificá que **cada código de renglón exista en el catálogo vigente**; los que no existan se rechazan con la lista a la vista.
- Truncá o rechazá las aclaraciones de más de 200 caracteres.
- Ningún campo importado llega al DOM sin escapar.

Un JSON malformado produce un mensaje de error con el detalle de qué está mal, nunca una excepción ni un formulario a medio llenar.

### 3.5 — La pantalla

`app/index.html` pasa de ser la pantalla de búsqueda a ser la aplicación: selección de operador (ADR-017: nombre, apellido, rol y correo a la vista), y el wizard. El buscador del ciclo 4 queda embebido en el paso 2, no como pantalla suelta.

El `README.md` sigue documentando el arranque en un comando, y qué se espera ver ahora.

### 3.6 — Tests

Conservando en verde todo lo anterior, y con el repositorio clonado en limpio:

1. Los tramos de coincidencia son índices válidos de `resultado.clase` y el fragmento resaltado contiene el término buscado. Sobre el catálogo real, no sobre un caso de laboratorio.
2. No se puede avanzar de paso con el paso inválido; el mensaje de error existe y es legible.
3. El borrador sobrevive a la recarga y no se ofrece a un operador distinto.
4. Fast-Track: un JSON con un código inexistente se rechaza y lo nombra; uno con una aclaración de 201 caracteres se rechaza; uno con `<script>` en un campo de texto no ejecuta nada.
5. Creación completa: al confirmar, existe el `datos.json`, existe su entrada en `idx/`, el número es único y la auditoría tiene la entrada de creación con el correo.
6. Fallo del servidor a mitad de la confirmación: el borrador sigue ahí.
7. Los tests del build pasan en un clon limpio, sin el catálogo completo presente.

### 3.7 — `INFORME-RONDA-05.md`

Las ocho secciones del ciclo anterior, más:

```
## 9. Correcciones arrastradas
Una línea por cada punto de §2: qué hiciste y cómo lo verificaste.
```

---

## 4. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. Recordatorio de la primera: **la documentación es de sólo lectura**, incluida `BITACORA_DECISIONES.md`.

Cierre: `node --test` y el guardián en verde **en un clon limpio**, informe completo, y **un solo commit** con mensaje `Ronda 5 — H5 Wizard de Fase 1`. Sin push, `git status` limpio.

Recordá que el auditor sólo va a ver lo commiteado. Si te quedás sin margen, commiteá primero y refiná después.

---

## 5. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` **en un clon recién hecho** | Todo en verde, sin archivos externos |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | Tramos de coincidencia sobre el catálogo real | Índices válidos de `clase`, fragmento contiene el término |
| 4 | Escape cierra ambos desplegables | Sí |
| 5 | Generador con entrada corrupta | Mensaje claro, sin stack trace |
| 6 | `grep estadoActual app/` | Cero ocurrencias |
| 7 | Documentación modificada | Ninguna, verificable por `git diff` |
| 8 | Wizard: no avanza con el paso inválido | Bloquea y explica |
| 9 | Borrador sobrevive a la recarga | Sí, y no se ofrece a otro operador |
| 10 | Fast-Track con JSON hostil | Rechaza con detalle, sin excepción ni inyección |
| 11 | Alta completa de un expediente | `datos.json` + `idx/` + auditoría con el correo |
| 12 | Recorrido completo por teclado | Del primer campo a la confirmación, sin mouse |
| 13 | `INFORME-RONDA-05.md` con sus 9 secciones | Completo |

Se va a correr una **batería externa** que levanta tu servidor, recorre el alta de un expediente, le tira JSON hostil al Fast-Track y verifica lo que queda en disco.

---

## 6. Qué se está evaluando

Que un jefe de división pueda sentarse, cargar un requerimiento real y que del otro lado quede un expediente bien formado. Todo lo anterior existía para llegar acá.

Pesa, en este orden: (1) las correcciones de §2, empezando por los tramos, (2) que el alta funcione de punta a punta contra la batería externa, (3) la robustez del Fast-Track ante entrada hostil, (4) que el recorrido por teclado sea real, (5) honestidad del informe, (6) prolijidad.

Un wizard que se ve bien y deja pasar datos malos es exactamente el problema que este sistema vino a resolver.
