# INFORME-RONDA-18-BIS

Cierre de corrección urgente · ORDEN-RONDA-18-BIS.
El Jefe de Contrataciones estaba bloqueado con el servidor andando.

---

## 1. Qué pasó

La pantalla de administración del padrón descartaba la clave en los tres casos
en que el servidor la produce y devuelve una sola vez:

| Caso | Servidor devuelve | Pantalla hacía |
|---|---|---|
| Alta de a uno | `{ creado, clave }` | Informaba "Se dio de alta a X" y tiraba `clave` |
| Importación CSV | `creados: [{ email, clave }, …]` | Informaba conteos y tiraba el arreglo entero |
| Reposición de clave | `{ email, clave }` | Pasaba por `accion()` que descartaba la respuesta |

Resultado: el administrador era el único que podía entrar al sistema. Para
siempre. Se creaban las personas, aparecían en el listado, quedaban activas —
y ninguna tenía forma de recibir su clave.

---

## 2. Las tres correcciones (todas en `padron-admin.js`)

### §1.1 — Alta muestra la clave

Después del alta exitosa, el bloque de clave aparece en pantalla:
correo + clave, con texto que dice que es la única vez, botón "Copiar" y
botón "Cerrar". Se puede seleccionar con el mouse. Queda hasta que la persona
lo cierre — no se va con el refresco de la lista.

### §1.2 — Importación muestra las claves

Después de importar, cada persona creada aparece con su correo y clave en
una línea. Botón "Copiar todo" que copia la lista entera con formato de
tabulador (para pegar en un documento e imprimir y repartir en mano,
conforme ADR-034 §1).

### §1.3 — Reposición muestra la clave repuesta

La reposición de clave ahora tiene su propio camino (`reponerClave`) en
lugar de pasar por `accion()` que descartaba la respuesta. Muestra el
mismo bloque que el alta.

Revisión de `accion()`: las demás acciones (baja, reactivar, rol,
desbloquear, administrador) devuelven `{ email, activo/rol/bloqueado }`
— valores que el mensaje de éxito ya comunica. Ninguna devuelve algo que
la persona necesite ver除了 clave.

---

## 3. Dos mejoras adicionales (§2)

### §2.1 — Formulario inline

Los cinco `prompt()` encadenados se reemplazaron por un formulario en la
pantalla: nombre, apellido, correo, sector y rol como lista desplegable
(los roles salen de `SGC.core.config.ROLES`). Error al lado del campo,
no se pierde lo tipeado.

### §2.2 — Selector de archivo

El `prompt()` para pegar CSV se reemplazó por un `<input type="file">`
más una opción de pegar texto (para el caso de que el padrón venga en un
correo). El flujo de previsualización y confirmación no se tocó.

---

## 4. Tests

`tests/ronda-18-bis.test.js`: 5 tests.

| # | Qué verifica | Estado |
|---|---|---|
| 1 | Alta → respuesta trae clave con formato correcto | verde |
| 2 | Importación de 3 líneas → las 3 claves aparecen | verde |
| 3 | Reposición → la clave repuesta aparece | verde |
| 4 | Bloque de clave sobrevive al refresco del listado | verde |
| 5 | **Circuito completo**: crear operador, tomar clave, entrar con ella | verde |

El test 5 es el que cierra el circuito. Si hubiera existido, esta orden
no existiría.

### Regresiones

| Archivo | Tests | Pass | Fail |
|---|---|---|---|
| ronda-18-bis | 5 | 5 | 0 |
| ronda-18 | 13 | 13 | 0 |
| ronda-13 | 15 | 14 | 1 (preexistente `modoPiloto`) |
| ronda-14 | 12 | 12 | 0 |
| ronda-17 | 21 | 21 | 0 |
| **Total** | **66** | **65** | **1** |

`check-compat` server/app: 0 violaciones.

---

## 5. Contradicciones

- **`accion()` no puede recibir la clave de reposición.** Fue diseñada
  como genérica (email, acción, cuerpo, mensaje) y descarta la respuesta.
  La reposición necesitó su propio camino. Si en el futuro alguna otra
  acción devuelve algo que la persona necesite ver, `accion()` tendrá que
  reestructurarse — por ahora, sólo la clave lo requiere.

---

## 6. Lo que se lleva el paquete

Archivos modificados:
- `app/index.html` — tres contenedores nuevos (`#sgc-padron-clave`,
  `#sgc-padron-formulario`, `#sgc-padron-importar-area`)
- `app/js/views/padron-admin.js` — formulario inline, bloque de clave,
  importación con selector de archivo, `reponerClave()`

Archivos nuevos:
- `tests/ronda-18-bis.test.js` — 5 tests

No se toca el servidor. El servidor ya hacía lo correcto.

---

## 7. Verificación técnica

```
node --test tests/ronda-18-bis.test.js     # 5/5 verdes
node --test tests/ronda-18.test.js         # 13/13 verdes
node --test tests/ronda-13.test.js         # 14/15 (1 preexistente)
node --test tests/ronda-14.test.js         # 12/12 verdes
node --test tests/ronda-17.test.js         # 21/21 verdes
node tools/check-compat.js server          # OK · 0 violaciones
node tools/check-compat.js app             # OK · 0 violaciones
```

`padron-admin.js`: 462 líneas (excede la convención de 400 del §3.1 de
RONDA-10; el crecimiento es por el formulario inline + bloque de clave
+ selector de archivo — funcionalidad nueva, no acumulación de funciones).

---

## 8. Criterios de aceptación

- Las tres correcciones están en `padron-admin.js` y sostenidas por tests.
- El servidor no se tocó (hacía lo correcto).
- El circuito completo funciona: crear operador → tomar clave → entrar.
- El sistema ya no es monousuario.
