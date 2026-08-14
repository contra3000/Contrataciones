# ORDEN DE TRABAJO — RONDA 4

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H4 — Catálogo de ítems y autocompletado**
Emitida: 2026-08-14

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

### Accesos fuera del repositorio (leer antes de pedir permisos)

Esta ronda necesita **exactamente tres cosas** fuera del árbol del proyecto. Ninguna otra:

1. **`os.tmpdir()`** — para los archivos temporales de los tests. Obligatorio desde la ronda 3.
2. **Puertos locales de red** (`127.0.0.1`) — para levantar el servidor y probarlo.
3. **Nada más.** El catálogo de ítems **ya está dentro de tu repositorio**, en `datos-prueba/catalogo_incisos.json`. No lo busques en otra carpeta del disco ni salgas de la raíz del proyecto a buscarlo.

Si te encontrás necesitando algo fuera de esta lista, **detenete y anotalo en el informe** en lugar de insistir con el pedido.

---

## 1. Alcance

Que un operador encuentre el ítem correcto entre 159.366 en menos de diez segundos, sin descargar cuarenta megabytes.

Y algo nuevo, que a partir de acá es permanente: **esta ronda deja la aplicación funcionando y visiblemente mejor que antes.** Hasta ahora todo era núcleo y servidor; se podía arrancar la app pero no había nada que mirar. Al cerrar esta ronda tiene que haber una pantalla real donde alguien busque un ítem y lo encuentre.

**Fuera de alcance:** el wizard completo de carga de expedientes, el tablero Kanban, la generación de entregables. La pantalla de esta ronda es la de búsqueda de ítems, no la aplicación entera.

---

## 2. Correcciones arrastradas (obligatorias)

### 2.1 — Trabajo de la ronda 3 sin registrar

Si en tu repositorio hay trabajo de la ronda 3 sin commitear, o falta el `INFORME-RONDA-03.md`, resolvelo **primero**: escribí el informe retroactivo con las siete secciones —incluida la 7, con la evidencia real de los tests de concurrencia— y dejalo en un commit propio con mensaje `Ronda 3 — H3 Persistencia y servidor` antes de empezar lo nuevo.

Si la ronda 3 quedó interrumpida por un permiso denegado, **decilo en la sección 4**: qué pediste, para qué, y qué no pudiste terminar por eso. No es una excusa, es información que necesito.

### 2.2 — La aplicación tiene que arrancar con un comando

El `README.md` debe documentar, en la primera pantalla y sin rodeos, cómo levantar la app y verla en el navegador. Un solo comando de arranque, la dirección donde se abre, y qué se espera ver. Esto se verifica en cada ronda de acá en adelante.

---

## 3. Entregables nuevos

### 3.1 — `tools/build-catalogo.js` — el generador de fragmentos

Transforma `datos-prueba/catalogo_incisos.json` (159.366 registros, ~40 MB) en fragmentos servibles bajo `app/catalogo/`. Se corre a mano, una vez por actualización mensual del catálogo; **no se ejecuta en tiempo de aplicación**.

```
node tools/build-catalogo.js --entrada datos-prueba/catalogo_incisos.json --salida app/catalogo
```

Produce, como mínimo:

| Archivo | Contenido |
|---|---|
| `app/catalogo/manifiesto.json` | `catalogoVersion`, cantidad de registros, cantidad de fragmentos, fecha de generación |
| `app/catalogo/rubros.json` | los 50 rubros |
| `app/catalogo/clases.json` | los ~6.908 pares rubro/clase, con identificador de fragmento y cantidad de ítems |
| `app/catalogo/items/<idClase>.json` | los ítems de esa clase (~23 en promedio) |

Reglas:

1. **Se descarta el campo `estado`** (ADR-014): vale `Activo` en los 159.366 registros porque el filtro está en el scraper. Es redundante por construcción.
2. **`catalogoVersion`** se estampa en el manifiesto y es lo que después queda registrado en cada expediente.
3. El build es **determinista**: dos corridas sobre la misma entrada producen archivos byte a byte idénticos. Nada de marcas de tiempo dentro de los fragmentos salvo en el manifiesto.
4. **Ningún archivo generado supera los 300 KB.** Si alguna clase es tan grande que su fragmento se pasa, partila y dejalo asentado en el informe.
5. El generador informa por pantalla lo que produjo: cantidad de fragmentos, tamaño del más grande, tamaño total.

### 3.2 — `app/js/catalogo/indice.js` — la búsqueda, pura

**Sin DOM y sin red.** Recibe los datos ya cargados y busca sobre ellos. Es la parte que se puede probar bajo Node sin navegador, y por eso es donde va la lógica.

```js
SGC.catalogo.indice.montar({rubros, clases})   // carga el índice en memoria
SGC.catalogo.indice.buscarClases(texto, limite)
//   -> [{idClase, rubro, clase, cantidad, coincidencias:[[inicio,largo],…]}]
SGC.catalogo.indice.filtrarPorRubro(rubro)     // -> [{idClase, clase, cantidad}]
SGC.catalogo.indice.buscarEnItems(texto, items, limite)
//   -> [{codigo, item, coincidencias:[[inicio,largo],…]}]
```

`coincidencias` son los tramos del texto que coincidieron, para que la interfaz los pueda resaltar sin volver a buscar. La búsqueda ignora mayúsculas y **acentos**: `valvula` tiene que encontrar `VÁLVULA`.

### 3.3 — `app/js/catalogo/carga.js` — la carga

El único módulo que toca la red. Trae el manifiesto y el índice al iniciar, y los fragmentos por demanda. Cachea en memoria los fragmentos ya visitados. **Rutas siempre relativas** — ninguna URL absoluta, ni siquiera al propio servidor (ADR-018).

IndexedDB como caché entre sesiones es **opcional** y sólo si sobra tiempo: dejó de ser requisito de arquitectura en ADR-004. Si lo implementás, tiene que degradar sin romper cuando no esté disponible.

### 3.4 — `app/js/catalogo/buscador.js` y la pantalla

El componente visible. Un campo de búsqueda con autocompletado en cascada **rubro → clase → ítem**, con los tramos coincidentes resaltados, y la posibilidad de armar una lista de renglones.

Cada renglón seleccionado se compone de `{codigo, cantidad, unidad, aclaracion}` y se valida con `SGC.core.validacion.validarRenglon` — la función que ya existe desde la ronda 2. El campo `aclaracion` es opcional, **máximo 200 caracteres**, con el contador a la vista, y su razón de ser debe estar explicada en pantalla: se usa cuando el ítem exacto no está en el catálogo y hay que tomar el más parecido (enmienda de ADR-014).

Requisitos de la pantalla:

- `app/index.html` deja de ser un esqueleto y pasa a ser la pantalla de búsqueda, servida por el servidor de la ronda 3.
- **Navegable enteramente por teclado**: flechas para recorrer las sugerencias, Enter para elegir, Escape para cerrar. Con `aria-*` y foco manejado.
- Chrome 109 es el techo (ADR-011). Sin `popover`, sin anidamiento CSS nativo. Tu propio guardián te lo va a decir.
- Sin emojis. Íconos como SVG en línea si hacen falta.

### 3.5 — `tools/medir-catalogo.js` — el banco de medición

Imprime números, no impresiones:

- Peso del índice inicial (rubros + clases) y tiempo de carga.
- Tiempo de `buscarClases` sobre el índice completo, promedio de 100 búsquedas distintas.
- Peso del fragmento más grande y tiempo de carga de un fragmento.

**Presupuesto que hay que cumplir:** índice inicial por debajo de **300 KB**; `buscarClases` por debajo de **100 ms**; ningún fragmento por encima de **300 KB**. Si algo no entra, no lo escondas: reportalo en el informe con el número real.

### 3.6 — Tests

Conservando en verde todo lo anterior:

1. El build es determinista: dos corridas producen lo mismo.
2. El build descarta `estado` y estampa `catalogoVersion`.
3. La suma de ítems de todos los fragmentos es exactamente **159.366**.
4. Ningún fragmento supera 300 KB.
5. `buscarClases('valvula')` encuentra clases escritas con `VÁLVULA` — sin acentos y sin mayúsculas.
6. `buscarClases` devuelve los tramos de coincidencia correctos para resaltar.
7. Una clase conocida devuelve la cantidad de ítems que declara `clases.json`.
8. `validarRenglon` rechaza un código que no existe en el catálogo generado.
9. La pantalla se sirve: `GET /` devuelve 200 y el HTML contiene el campo de búsqueda.

### 3.7 — `INFORME-RONDA-04.md`

Las seis secciones de siempre, más dos:

```
## 7. Mediciones
La salida literal de tools/medir-catalogo.js y si entra en el presupuesto de §3.5.

## 8. Accesos fuera del repositorio
Qué necesitaste fuera del árbol del proyecto, para qué, y si te lo concedieron.
Si algo te fue denegado y eso te impidió terminar, decilo acá.
```

---

## 4. Reglas de conducta

Las siete de `ORDEN-RONDA-01.md` §3, sin cambios. Commit único: `Ronda 4 — H4 Catalogo y autocompletado`.

---

## 5. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` | Todo en verde, rondas 1 a 3 incluidas |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | `node tools/build-catalogo.js …` | Corre y produce el manifiesto y los fragmentos |
| 4 | Suma de ítems en los fragmentos | Exactamente 159.366 |
| 5 | Fragmento más grande | ≤ 300 KB |
| 6 | Índice inicial (rubros + clases) | ≤ 300 KB |
| 7 | `buscarClases` promedio de 100 búsquedas | < 100 ms |
| 8 | Búsqueda sin acentos y sin mayúsculas | Encuentra |
| 9 | Servidor arriba, `GET /` | 200, con el campo de búsqueda en el HTML |
| 10 | Navegación por teclado del autocompletado | Flechas, Enter y Escape funcionan |
| 11 | `README.md` | Documenta el arranque en un comando |
| 12 | `INFORME-RONDA-04.md` con sus 8 secciones | Completo |

Se va a correr una **batería externa** que ejecuta tu generador sobre el catálogo real, verifica los fragmentos, ejercita `SGC.catalogo.indice` bajo Node con casos que no conocés, y levanta tu servidor para mirar la pantalla.

---

## 6. Qué se está evaluando

Que un operador de la División pueda encontrar lo que busca. Todo lo anterior fue infraestructura; esto es lo primero que una persona va a tocar, y el FSD dice en su primera línea que el problema a resolver es la mala calidad de los datos de entrada. Una búsqueda que no encuentra produce exactamente eso.

Pesa, en este orden: (1) que la pantalla funcione de verdad y sea usable con teclado, (2) corrección del generador y de la búsqueda bajo la batería externa, (3) cumplimiento del presupuesto de rendimiento con números medidos, (4) honestidad del informe, (5) cobertura de tests, (6) prolijidad.

Una búsqueda vistosa que tarda 400 ms vale menos que una sobria que tarda 40.
