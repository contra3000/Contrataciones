# ORDEN DE TRABAJO — RONDA 20

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H23 — el circuito de la persona llega hasta el final**
Emitida: 2026-09-11

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

### Lo que hiciste bien en la ronda 19, y conviene que quede dicho

**La corrección del asistente es exacta y mínima**: tres líneas, ningún efecto lateral, y el diagnóstico de tu informe es el correcto. Desataste de un tirón tres bloqueos que venían de la misma raíz.

**Y la montura nueva es la mejor pieza de infraestructura del proyecto.** `tests/helpers/aplicacion-montura.js` arma el DOM **desde `app/index.html`**, sin `innerHTML`, carga los scripts en el orden del documento, ejecuta `app.js` por sesión y habla con un servidor real. El auditor lo comprobó quitando la corrección de `app.js:112`: los dos e2e nuevos **se ponen en rojo**. No son tests maquillados.

Esa montura es lo que hace posible toda esta ronda. Sin ella, nada de lo que sigue sería verificable.

### El incumplimiento, que se corrige acá

La orden 19 pedía **reescribir los nueve tests del asistente para que entren por la puerta real, y eliminar los que no se puedan reescribir**. No hiciste ninguna de las dos cosas: agregaste en `wizard.test.js:22-29` un comentario explicando cómo el camino real llega al mismo estado, y las nueve llamadas a mano siguen ahí (líneas 116, 149, 156, 162, 214, 243, 285, 329 y 374).

Se te reconoce que **no lo ocultaste** —lo confesaste en el comentario, y el informe no afirma lo contrario— y que **no se perdió verificación**, porque los e2e cubren esas siete afirmaciones. Por eso es medio y no alto.

Pero es la **cuarta vez** en este proyecto que una regla queda escrita en castellano y no en el código. La decisión del revisor es no: **se reescriben o se eliminan, en esta ronda.**

### Y el número que ordena todo lo demás

El auditor contó cuántos caminos de persona tiene el sistema y cuántos tienen un test que los recorre entero **sin ayuda**:

**Nueve caminos. Dos cubiertos. Uno parcial. Seis sin nada.**

Ese número es el objetivo de esta ronda. No "que ande": que esté recorrido.

### Accesos fuera del repositorio

`os.tmpdir()`, `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

---
## Reglas de tiempo y de arranque · **léelas antes de ejecutar el primer comando**

*Pedido del Jefe de Contrataciones (2026-09-11) y recomendación del propio auditor al cierre del ciclo 19, que perdió cuatro cuelgues largos por esta causa: «mientras el orquestador no adopte timeouts + chequeo de salud + conteo DOM, toda orden futura va a colgar de la misma forma».*

**Ningún comando corre "hasta que termine".** Si se vence el tope, el proceso se mata, se anota, y se sigue.

### Los topes

| Qué | Tope | Si se vence |
|---|---|---|
| Arrancar un servidor y comprobar que responde | **60 s** | Matarlo y anotar. Un reintento como máximo |
| Una petición HTTP suelta | **15 s** | Anotar la ruta y seguir |
| La suite de tests completa | **600 s** | Matarla, anotar hasta dónde llegó, correr el resto por partes |
| Un archivo de tests suelto | **120 s** | Matarlo y anotar cuál |
| La batería adversaria completa | **900 s** | Igual que la suite |
| El generador de pliegos (`python`) | **120 s** | Matarlo y anotar el expediente que lo colgó |
| Un paso de navegador (CDP) esperando un render | **20 s** | Anotar qué se esperaba y qué había en el DOM |
| **Cualquier otro comando** | **300 s** | Matar y anotar |

### Las cinco medidas de arranque · las trajo el auditor del ciclo 19 y son obligatorias

1. **Ningún comando de consola ni script de navegador sin tope acotado.** Ninguno.
2. **Nunca `Get-NetTCPConnection` ni ningún cmdlet de red bloqueante** para averiguar si un puerto está ocupado. Midió lento y fue causa directa de cuelgues. Si necesitás saber si el puerto responde, hacé una petición con tope.
3. **Avanzar sólo cuando el DOM confirma el render esperado.** Nunca a ciegas, nunca con una espera fija. Contá nodos: si no aparecieron, es un hallazgo, no una razón para esperar más.
4. **`GET /api/salud` antes y después de cada arranque**, con un reintento. Si no responde, el servidor no está listo y no tiene sentido seguir.
5. **Una sola pestaña de Chrome**, con navegación fresca por rol. En headless el BFCache no vuelve a ejecutar los manejadores y produce pantallas falsas — pantallas que parecen correctas y no lo son.

### Tres reglas que no se negocian

**1 · El que enciende, apaga.** Todo servidor que arranques lo matás vos, en el mismo paso, aunque el paso haya fallado. **No puede quedar ningún proceso vivo al terminar la ronda**: un servidor huérfano escuchando en un puerto hace que la ronda siguiente arranque rota y nadie entiende por qué. El ciclo 19 perdió horas exactamente así, con hijos huérfanos redirigiendo a un archivo abierto sin devolver el control.

**2 · Un tope vencido es un hallazgo, no un accidente.** Va al informe con el comando, el tope y el tiempo real. **Un reintento como máximo**; si vuelve a vencer, se abandona ese punto, se escribe en *"qué NO hice"*, y se sigue. Reintentar en círculo está prohibido.

**3 · La ronda siempre termina con commit e informe, aunque esté incompleta.** Quince minutos trabado en el mismo punto es el límite para abandonarlo. **Media ronda entregada vale más que una ronda completa que nadie recibió** — es la lección del ciclo 10, que se hizo entero y se perdió por no cerrarlo.

### Cómo se hace, en concreto

```powershell
# Arrancar con tope, y matar SIEMPRE
$p = Start-Process node -ArgumentList 'server\servidor.js','--config','...' -PassThru
try {
  # esperar la salud, con tope y reintento — nunca una espera fija
  # ... la prueba ...
} finally {
  if (!$p.HasExited) { Stop-Process -Id $p.Id -Force }
}

# Un comando cualquiera con tope
$j = Start-Job { node --test tests\archivo.test.js }
if (Wait-Job $j -Timeout 120) { Receive-Job $j } else { Stop-Job $j; 'TOPE VENCIDO' }
Remove-Job $j -Force
```

### Y lo que nunca se hace

- **Ningún comando que espere el teclado**: nada de `pause`, editores interactivos ni preguntas de consola. Si una herramienta pregunta, se le pasa la respuesta por argumento.
- **Ningún proceso en segundo plano que sobreviva al paso** que lo arrancó.
- **Ningún `git` sobre la carpeta montada sin tope**: `git status` ahí se cuelga y devuelve vacío, que se lee igual que "todo limpio" (§3.6). Controlá el código de salida: `124` no es `0`.
- **Nota operativa del ciclo 19**: `node --test tests` no corre como carpeta en Node v24. Se corre `node --test` con los archivos, o desde la raíz.

---

## 1. Los tres que cortan el circuito · **van primero, en este orden**

### 1.1 — H1 · El presupuesto no sube · tres archivos que no se hablan (medio-alto)

```js
// app/js/views/requerimiento-presupuestos.js:103 — el front manda…
{ nombreOriginal: file.name, tipo: ..., contenidoBase64: base64 }

// app/js/adapters/repo.http.js:269 — el adaptador lee otro nombre…
{ nombreOriginal: ..., tipo: ..., contenido: datos.contenido }   // ← undefined

// server/presupuestos.js:42 — y el servidor lo exige como texto
typeof cuerpo.contenido !== 'string'   →   400
```

**Corregí el nombre en un solo lugar y dejá el resto quieto.** Elegí vos cuál, pero decilo en el informe con el motivo. Lo que no se negocia: **después de esto tiene que haber un nombre solo para ese campo en todo el recorrido**, y un test que lo pruebe subiendo un archivo **por la pantalla**, no por el adaptador.

Y anotá esto, porque es lo que importa: **el defecto existía desde hace ciclos** y no se vio porque la montura vieja falseaba `repo.guardarPresupuesto`. Es la tercera aparición de *el banco de pruebas fabrica lo que la aplicación no produce*. Mientras arreglás, **buscá si queda alguna otra función del repositorio falseada en las monturas**, y listalas todas en el informe con lo que decidiste sobre cada una.

### 1.2 — H2 · El ANEXO 1 esconde toda la aplicación (alto)

`app.js:229` le pasa `<main id="app">` —la raíz entera— a `anexoUno.montar()`, y `anexo-uno.js:220-232` le pone `hidden = true` a esa raíz cuando el estado no es `ANALISIS_SCo`. Con `[hidden]{display:none !important}`, desaparece la aplicación completa.

**Una vista se quedó con la llave de toda la casa.** Dos cosas:

- El ANEXO 1 recibe **su propia sección**, nunca la raíz, y sólo puede ocultarse a sí mismo.
- Y revisá si hay **otra vista** que reciba la raíz y pueda esconderla. Si existe, es el mismo defecto esperando turno; listalas todas en el informe, incluidas las que están bien.

Además, en el estado que sí activa el anexo **no hay alternancia de secciones**: se muestra todo o nada. Entra en el mismo arreglo.

### 1.3 — H3 · El ANEXO 1 nunca guardó un solo dato (alto)

Doce identificadores que no coinciden entre el JavaScript y el HTML:

| El JS busca | El HTML tiene |
|---|---|
| `-responsable` | `-unidad-resp` |
| `-pac` | `-pac-previsto` |
| `-precio` | `-precio-ref` |
| `-direccion` · `-telefono` · `-correo` | `-unidad-dir` · `-unidad-tel` · `-unidad-correo` |
| `-entrega` · `-facturacion` | `-lugar-entrega` · `-lugar-fact` |
| `-numero-orden` · `-trimestre` | `-pac-orden` · `-pac-trimestre` |
| `-bienes` · `-documentacion` | `-bienes-uso` · `-doc-obligatoria` |

Los campos se escriben sobre nodos que no existen y **el objeto guardado queda vacío, en silencio**. El ANEXO 1 nunca tuvo datos reales guardados desde la pantalla, en ningún ciclo.

**Es independiente de H2**: arreglar el `hidden` no hace que los campos se escriban.

La corrección no es sólo alinear los doce. **Es que esto no pueda volver a pasar sin ruido:** cuando la vista busca un nodo por identificador y no lo encuentra, **tiene que fallar de forma visible** —no escribir sobre `null` ni seguir como si nada—. Es ADR-029 aplicado al DOM: *lo que falta, falla ruidosamente*.

Y verificá lo mismo en las otras vistas que buscan nodos por identificador: **¿cuántas más escriben sobre nodos inexistentes?** Al informe, con la lista.

### 1.4 — H4 · Después de «Salir» conviven dos pantallas (bajo)

Queda visible `#sgc-seleccion-operador` —la lista del modo declarado, vacía— junto con el formulario de ingreso. `index.html:24` arranca sin `hidden`, `ingreso.js:47` sólo controla el formulario, y `estado.operador` no se limpia a `null`.

Al salir, el sistema vuelve a **una pantalla de ingreso limpia**, y la sección del modo declarado no aparece nunca en modo autenticado.

---

## 2. Los nueve tests · reescribir o eliminar

Cada uno de los nueve empieza con `SGC.views.wizard.seleccionarOperador(MARIA, repoFalso)` —la llamada que la aplicación autenticada no hace—. Ese arranque se reemplaza por el de la montura real. **Lo que verifican después se conserva**: son siete afirmaciones válidas sobre validaciones, pasos y persistencia.

**El que no se pueda reescribir así, se elimina.** En el informe, uno por uno: cuál se reescribió, cuál se eliminó, y por qué.

### Y el linaje completo, que el auditor barrió

| Archivo | Ocurrencias |
|---|---|
| `tests/expediente.test.js` | 6× `expediente.seleccionarOperador` |
| `tests/expediente-matriz.test.js` | 1× |
| `tests/exportar.test.js` | 1× |
| `tests/ronda-13.test.js` | `archivo.fijarRepo / montar / refrescar` a mano |
| `tests/kanban.test.js` | `kanban.montar / fijarRepo / refrescar` a mano |

**No los reescribas todos en esta ronda** — sería demasiado y no es lo que más urge. Hacé esto: **marcá cada uno con una línea que diga que arma el estado a mano y qué camino de persona debería cubrirlo**, y anotalos en el plan. Se saldan cuando ese camino tenga su e2e.

La distinción sigue siendo la misma: *legítimo* es un test unitario que le pasa una entrada a una función y verifica su salida (`requerimiento-formulario.test.js` y `ronda-12.test.js` lo son, y no se tocan). *No legítimo* es armar el estado de una vista a mano y concluir que el circuito anda.

---

## 3. Los caminos descubiertos · **el corazón de esta ronda**

De los nueve caminos de persona, seis no tienen ningún test y uno está a medias. Esta ronda cierra **cuatro**, todos con la montura real, todos por el DOM:

### 3.1 — C2 completo · el generador carga un requerimiento de verdad

Hoy el e2e llega a crear y guardar **con un renglón y sin presupuestos**. Tiene que llegar a **tres renglones del catálogo y dos presupuestos subidos por la pantalla** — que es lo que desbloquea H1 y lo que hace una persona de verdad.

### 3.2 — C3 · genera el documento y exporta el pliego

Del requerimiento completo al entregable y al archivo del generador. **Y con el generador real corriendo**, si está disponible; si no, dejalo declarado.

### 3.3 — C4 · el expediente avanza de rol

Entrar con un `abastecimiento`, abrir el expediente, y **hacerlo avanzar al paso siguiente**. Por el DOM: los botones que ve esa persona, no la API.

### 3.4 — C5 · el ANEXO 1, que es el que nunca existió

Llenar el formulario **por la pantalla**, guardarlo, **volver a abrirlo, y que los datos estén**. Es la prueba que H3 vuelve posible, y hasta hoy no se podía escribir.

**Los otros tres —C6 la cadena hasta la firma, C7 las catorce claves, C9 salir y volver— no entran en esta ronda.** Quedan anotados en el plan con su número. No los empieces: prefiero cuatro cerrados que siete a medias.

---

## 4. Tests

Los de cada punto, y el criterio que ya rige desde la ronda 19:

- Cada corrección con **un test que falla si se revierte**. El auditor lo va a comprobar quitándola.
- **Todo por la montura real.** Si un test necesita que invoques a mano algo que la aplicación no invoca sola, está mal escrito.
- Y el número: al terminar esta ronda, **6 de 9 caminos** tienen que estar cubiertos (C1, C2 completo, C3, C4, C5, C8). Decilo en el informe con esa cuenta hecha.

---

## 5. `INFORME-RONDA-20.md` — en la raíz del repositorio

Las nueve secciones de siempre. Cuatro cosas propias:

- La lista de **funciones de repositorio falseadas** en las monturas, con lo que decidiste sobre cada una.
- La lista de **vistas que reciben la raíz** y pueden esconderla.
- La lista de **vistas que escriben sobre nodos por identificador**, y cuáles no fallan cuando el nodo no está.
- Los **nueve tests**, uno por uno: reescrito o eliminado.

Y en §4, si algo de esta orden contradice una ADR o una orden anterior, **decilo y no lo hagas**. Ya pasó tres veces que tenías razón.

---

## 6. Cierre

Un solo commit, `Ronda 20`, **y push**. El control de entrega antes del auditor:

```
git log --oneline -1
git log origin/main --oneline -1
git status --short
```

**Y si el tiempo se acaba, cortá en este orden**: primero entregá H1, H2 y H3 con sus tests (§1); después los nueve tests (§2); y al final los caminos de §3, en el orden 3.1, 3.4, 3.3, 3.2. Lo de §3 es lo que puede quedar a medias sin romper nada.

---

## 7. Criterios de aceptación

- Un presupuesto se sube **por la pantalla** y queda guardado.
- El ANEXO 1 **no esconde la aplicación**, y lo que se escribe en él **se guarda y se vuelve a leer**.
- Una vista que busca un nodo y no lo encuentra **falla de forma visible**.
- Al salir, se ve **una** pantalla de ingreso.
- Los nueve tests del asistente: reescritos o eliminados, ninguno llamando a mano.
- **6 de 9 caminos de persona** con test que los recorre entero.
- La suite completa en verde, y cada corrección con su test que falla al revertirla.

---

## 8. Qué se está evaluando

**Que una persona pueda hacer su trabajo de principio a fin.**

La ronda 19 consiguió que pudiera empezar. Esta tiene que conseguir que pueda terminar: cargar el requerimiento completo con sus presupuestos, generar el documento, llenar el ANEXO 1, y pasárselo al que sigue.

El criterio no es que los tests estén en verde —lo estuvieron durante dieciocho rondas mientras el sistema no permitía crear un expediente—. El criterio es el número: **cuántos de los nueve caminos se recorren solos**. Hoy son dos. Al terminar esta ronda tienen que ser seis.
