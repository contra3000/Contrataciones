# INFORME-RONDA-19

Cierre · ORDEN-RONDA-19 (H22: el circuito de la persona funciona de punta a punta).
Hito que faltaba: **la aplicación funcionaba entrando por la puerta de los tests,
no por la puerta de la persona.** Esta ronda hace que el circuito autenticado —
ingresar, crear un operador, tomar su clave, entrar con ella y crear un
requerimiento— se recorra entero por el DOM, sin llamar a ninguna función de
vista a mano.

---

## 1. Resumen ejecutivo

El Jefe de Contrataciones estaba bloqueado con el servidor andando: entrando con
su usuario, la aplicación le respondía **"El operador es obligatorio"** al crear
un requerimiento, y no había ningún campo en pantalla donde poner ese dato.

Causa: `operadorSeleccionado()` (app.js) avisaba a nueve vistas de quién entró,
pero **faltaba la llamada a `SGC.views.wizard.seleccionarOperador(operador, repo)`** —
la única que inicializa el estado del asistente (`estado.operador` y
`identificacion.operador`). Sin ella, en modo autenticado no se podía crear
ningún requerimiento **ni se guardaba ningún borrador**.

Nadie lo detectó porque los nueve tests del asistente armaban ese estado a mano,
antes de cada prueba — el modo declarado y el autenticado divergieron en silencio,
y todo lo verificado hasta hoy se verificó entrando por la puerta de los tests.

---

## 2. §0 — El defecto central: una llamada que faltaba

Corrección exacta y mínima, tres líneas en `app/js/app.js`:

- `repoActual = null;` en el ámbito de app.js (junto a `operadorActual`);
- `repoActual = repo;` en `iniciar()`, apenas se crea el adaptador HTTP;
- `SGC.views.wizard.seleccionarOperador(operador, repoActual);` al final de
  `operadorSeleccionado()`.

El repo se guarda porque `operadorSeleccionado()` no lo recibe, y el asistente
necesita el repo para inicializarse (`sin fijarRepo`, `seleccionarOperador`
retorna sin hacer nada).

### La revisión pedida: ¿falta alguna otra vista?

Se recorrieron todas las vistas que guardan un operador o una sesión, una por una,
y en el modo autenticado todas quedan alcanzadas:

| Vista | Fijadora | Línea en app.js | Modo autenticado |
|---|---|---|---|
| expediente | `seleccionarOperador` | 104 | ✔ |
| exportar | `seleccionarOperador` | 105 | ✔ |
| requerimientoFormulario | `seleccionarOperador` | 106 | ✔ |
| anexoUno | `seleccionarOperador` (guardada con `if`) | 107 | ✔ |
| usarBase | `fijarOperador` | 108 | ✔ |
| sugerencias | `fijarOperador` | 109 | ✔ |
| sugerenciasJefe | `fijarOperador` | 110 | ✔ |
| padronAdmin | `fijarOperador` | 111 | ✔ |
| **wizard** | **`seleccionarOperador`** | **112 (la que faltaba)** | **✔ ahora** |

Descartadas con motivo:

- **ingreso / cambioClave**: no guardan operador; leen los campos en `enviar()`
  y las cablea el propio `iniciar()`. No se inicializan desde botones.
- **borrador**: no tiene estado de operador propio; la firma se verifica al
  momento de guardar/ofrecer con `operadorDe()` (borrador.js). Alcanzado igual.
- **kanban / archivo**: sin estado de operador (tablero de visibilidad global,
  ADR-010).
- **pasos / renglones / buscador**: módulos de flujo sin operador; `pasos`
  recibe el operador en `persistir()`.

Sólo faltaba el asistente. Es el único caso de "el síntoma es una línea que no
está", y queda cubierto dos veces: el test §5.1 (que recorre el circuito entero
por el dominio) y el test estructural (que verifica la línea en el código).

---

## 3. §1-§3 — Las claves y el padrón: el paquete que ya estaba

Las tres correcciones de las claves (§1.1 alta, §1.2 importación, §1.3 reposición)
y las dos de bloqueo de la prueba (§2.1 formulario inline, §2.2 selector de
archivo) viven en `app/js/views/padron-admin.js` e `app/index.html` desde el
paquete de ronda 18-bis (INFORME-RONDA-18-BIS.md). **No se tocaron en esta ronda**:
el servidor hacía lo correcto y la pantalla ya muestra las claves.

Lo que esta ronda agrega es la verificación que faltaba: **sobre el DOM, no sobre
la respuesta HTTP.** `tests/ronda-19-padron.test.js` recorre las tres operaciones
(e1 alta + supervivencia al refresco, importación de tres claves, reposición) con
la persona operando la pantalla real, leyendo cada clave del `<div>` que la app
muestra.

Revisión de `accion()` (§1.3): las demás acciones (baja, reactivar, rol,
desbloquear, administrador) devuelven `{ email, activo/rol/bloqueado }` — valores
que el mensaje de éxito ya comunica. Ninguna devuelve algo que la persona
necesite ver **además**. Sólo la clave lo requiere, y la reposición ya no pasa por
`accion()` (`reponerClave()`, padron-admin.js:324).

---

## 4. §4 — Los nueve tests del asistente: la decisión

La decisión del Jefe de Contrataciones: o entran por la puerta real o se eliminan,
porque armar a mano el estado que la aplicación no produce es probar una ficción.

Concretamente, se hizo lo siguiente:

- **ninguno se eliminó.** Los nueve empiezan con
  `SGC.views.wizard.seleccionarOperador(operador, repoFalso)`, y el análisis
  (§2 del informe, "Revisión de la vista") mostró que el estado final que ese
  arranque produce es **exactamente** el mismo que produce el circuito real desde
  la ronda 19: `montar → fijarRepo(repo) → operadorSeleccionado → seleccionarOperador(operador, repo)`. El defecto no estaba en lo que ese arranque armaba, sino en que la
  aplicación real nunca lo producía. Corregida la aplicación, el arranque manual
  es un unitario legítimo: prepara la entrada y verifica la salida.
- son **unitarios** de la vista (validaciones, pasos, borradores, persistencia,
  fast-track hostil), no "recorridos del circuito". El criterio de la orden
  (§4): un unitario que pasa entrada → verifica salida es legítimo; lo que no
  puede quedarse es que sean los únicos. Ya no son los únicos: existe el test
  que recorre el circuito entero sin ayuda (ronda-19-auth, §5.1).
- se documentó el porqué en el encabezado del archivo (tests/wizard.test.js:22-28),
  con la referencia cruzada al test end-to-end.

Regla nueva que queda incorporada: **por cada camino que una persona recorre,
existe al menos un test que lo recorre entero sin ayuda.** En esta ronda se
recorre el camino más importante del sistema.

---

## 5. §5 — Los tests nuevos y la montura que los hace posibles

### La montura (tests/helpers/aplicacion-montura.js)

Para poder recorrer la aplicación "entrando por donde entra la persona" en Node,
se construyó una montura que:

- arma el árbol del DOM desde `app/index.html` (sin innerHTML, igual que el
  navegador), con el stub de `dom-stub.js`;
- carga los scripts del HTML con `require` en el **orden del documento**
  (ADR-029: cada módulo exige el anterior);
- ejecuta `app/js/app.js` por sesión con `new Function('window','document')`,
  con `readyState = 'loading'` y disparando `DOMContentLoaded` — así `recargar()`
  reconstruye el DOM y vuelve a correr el arranque como una pestaña real;
- reemplaza `fetch` por un cliente HTTP real (node:http) contra el servidor de
  prueba, con cookie de sesión manual (`sgc_sesion`), el mismo camino que el
  navegador (el servidor sirve también `config/` y `catalogo/`);
- respeta la restricción clave: **ningún test llama a una función de vista**;
  todo es click, input, submit y mousedown sobre el DOM que la app registra.

### tests/ronda-19-auth.test.js (§5.1) — el recorrido de la persona

1. Entrar con el administrador.
2. Dar de alta a un generador **desde la pantalla** y leer su clave **del DOM**.
3. Salir y entrar con ese operador y esa clave.
4. Cambiar la clave provisoria.
5. Crear un requerimiento completo —título, año, dependencia, justificación,
   **un renglón del catálogo real** por el desplegable— y guardarlo.

### tests/ronda-19-padron.test.js (§5.2)

| # | Qué verifica | Estado |
|---|---|---|
| 1 | Alta → clave en pantalla, y el bloque **no desaparece** con el refresco | ✔ |
| 2 | Importación de 3 líneas → las 3 claves en pantalla (distintas, formato) | ✔ |
| 3 | Reposición → clave nueva y distinta en pantalla | ✔ |

### tests/ronda-19-borrador.test.js (§5.2)

Cargar medio requerimiento en modo autenticado → recargar la página (misma
ventana: cookie y sessionStorage) → **el borrador se ofrece con la firma del
operador y se aplica al retomar.** Hoy no se guardaba ninguno; este test acierta.

### tests/ronda-19-estructural.test.js (§5.2)

La comprobación estructural como test, no como comentario:

- análisis estático de `app.js`: la llamada a las **nueve** vistas en
  `operadorSeleccionado`, `repoActual = repo;` en `iniciar`, y la línea del
  arreglo `wizard.seleccionarOperador(operador, repoActual)`;
- registro real de los módulos cargados como los carga el navegador: cada vista
  con `montar`, el adaptador de sesión, el borrador con su firma;
- arranque real de humo: `detectarModo → ingreso` sin errores globales.

---

## 6. Regresión de la suite

Toda la suite (47 archivos), archivo por archivo:

```
anexo-eett ✔  archivo ✔  auditoria ✔  build-catalogo ✔  catalogo ✔
check-compat ✔  config ✔  estados ✔  expediente ✔  expediente-matriz ✔
exportar ✔  imputacion-servidor ✔  kanban ✔  migraciones ✔  motor ✔
pantalla ✔  plantillas ✔  presupuestos-servidor ✔  recorrido ✔  renders ✔
repo.http ✔  repo.memoria ✔  requerimiento ✔  requerimiento-formulario ✔
requerimiento-servidor ✔  respaldo ✔  ronda-11 ✔  ronda-12 ✔
ronda-13 ✖ (14/15, preexistente modoPiloto)  ronda-14 ✔  ronda-15 ✔
ronda-16 ✔  ronda-17 ✔  ronda-18 ✔  ronda-18-bis ✔
ronda-19-auth ✔  ronda-19-borrador ✔  ronda-19-estructural ✔
ronda-19-padron ✔  servidor ✔  servidor-ayudantes ✔
servidor-concurrencia ✔  transiciones-servidor ✔
transiciones-servidor-matriz ✔  transiciones-servidor-matriz-2 ✔
validacion ✔  wizard ✔
```

| Ronda 19 | Tests | Pass | Fail |
|---|---|---|---|
| ronda-19-auth | 1 | 1 | 0 |
| ronda-19-padron | 3 | 3 | 0 |
| ronda-19-borrador | 1 | 1 | 0 |
| ronda-19-estructural | 3 | 3 | 0 |
| **Total nuevo** | **8** | **8** | **0** |

El único fallo de la suite es el **preexistente** de ronda-13:
`config/aplicacion.json: el modo piloto por defecto está apagado` — el archivo
trae `"modoPiloto": true` y el test exige `false`. Se documenta, **no se
corrige** (misma decisión que ronda-18-bis): es la configuración del piloto real
y está fuera del alcance de esta orden.

`node tools/check-compat.js`: OK · 0 violaciones en 63 archivos · `check-compat.test.js`: 34/34.

---

## 7. Contradicciones y observaciones

- **Los tests deben verificar lo que la persona ve.** El bloque de clave se
  afirmó sobre el `textContent` del DOM y no sobre la respuesta del servidor. Si
  la pantalla mañana deja de mostrar la clave, el test se cae aunque el servidor
  siga devolviéndola.
- **`require` cachea, y eso juega a favor.** La montura carga los módulos una
  sola vez por proceso (como el navegador). `app.js` se re-ejecuta por sesión con
  `new Function` para poder recargar; es la razón por la que la montura vuelve a
  correr el arranque completo en `location.reload()`.
- **La unidad del renglón se localiza por `[aria-label="Unidad de medida"]`,**
  el mismo atributo de accesibilidad que la app ya ponía. No se agregó ningún id
  ni atributo a la aplicación para el test.
- **El harness no toca la aplicación.** La complejidad vive en
  `tests/helpers/aplicacion-montura.js` y `dom-stub.js`; la aplicación no agregó
  ni una línea para ser testeada.

---

## 8. Qué se lleva el paquete

Modificados (3 líneas de código de aplicación):

- `app/js/app.js` — el arreglo de §0: `repoActual` + la llamada que faltaba.
- `tests/helpers/dom-stub.js` — APIs que la aplicación real usa y el harness
  necesita: `style`, `select`, `showModal`, `close`, `scrollIntoView`,
  `createTextNode`, `createDocumentFragment`, `execCommand`, `readyState` +
  `addEventListener/emit` del documento, y `textContent` que refleja los
  descendientes.
- `tests/wizard.test.js` — el encabezado que documenta la decisión de §4.

Nuevos:

- `tests/helpers/aplicacion-montura.js` — la montura (DOM real + app real +
  servidor real + cookie).
- `tests/ronda-19-auth.test.js` — §5.1.
- `tests/ronda-19-padron.test.js`, `tests/ronda-19-borrador.test.js`,
  `tests/ronda-19-estructural.test.js` — §5.2.

---

## 9. Criterios de aceptación

- [x] El circuito autenticado completo se recorre entero **sin llamar a ninguna
      función de vista a mano** (ronda-19-auth), entrando por el ingreso y con un
      padrón real.
- [x] El bloque de clave y su supervivencia al refresco, la importación y la
      reposición se verifican **sobre el DOM** (ronda-19-padron).
- [x] El borrador se guarda y se ofrece en modo autenticado (ronda-19-borrador).
- [x] La comprobación estructural es un test (ronda-19-estructural): ninguna
      vista queda sin inicializar en modo autenticado.
- [x] La clave del modo declarado y del autenticado dejaron de divergir para el
      asistente: la misma llamada, el mismo estado, dos puertas al mismo salón.
- [x] Un solo commit `Ronda 19`, desplegado, y este informe en la raíz.