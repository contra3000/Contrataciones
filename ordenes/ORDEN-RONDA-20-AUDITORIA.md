# ORDEN DE AUDITORÍA — CICLO 20

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H23 — el circuito de la persona llega hasta el final**, según `ordenes/ORDEN-RONDA-20.md`
Emitida: 2026-09-11

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, `MOTIVOS.md` al día, y la integridad de la bitácora sobre **38 ADRs**.

### Tu ciclo anterior · el mejor de los diecinueve

Te cambié el método y lo tomaste sin resistirte. Recorriste el circuito completo con un expediente real, llegaste hasta `AUTORIZACION_SCo`, y encontraste **tres defectos que bloquean el sistema** que nadie había visto en diecinueve rondas — porque los tres sólo se ven manejándolo.

Cuatro cosas que hiciste y que quiero que repitas:

- **El experimento de quitar la corrección** (`app.js:112`) para probar si los tests la sostienen de verdad. Encontraste que los dos e2e nuevos se ponen en rojo y que los nueve viejos pasan igual. Eso es una medición, no una opinión.
- **El barrido de la suite entera** buscando el patrón prohibido, que encontró que el linaje era mucho más largo que los nueve.
- **El número de caminos cubiertos** — 2 de 9. Es la cifra más útil que produjo este proyecto y la que ahora ordena las órdenes.
- **Las dieciocho incidencias de tu propio proceso**, con medidas correctivas. Nadie te lo pidió. Las adopté enteras y están arriba en las dos órdenes de esta ronda.

Tenías razón en lo que me dijiste, y era sobre mí: *"mientras el orquestador no adopte timeouts + chequeo de salud + conteo DOM, toda orden futura va a colgar de la misma forma"*.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

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

> **Son tus propias medidas.** Si esta ronda vuelve a colgarse de la misma forma, quiero saber cuál de las cinco no alcanzó.

---

## 1. Verificación de conducta

Los ocho de siempre, la **batería completa** con `MOTIVOS.md` al día, y el informe **en la raíz** del repositorio.

---

## 2. El recorrido completo, otra vez, y más largo · **50% de la auditoría**

Mismo método que el ciclo 19, sobre carpeta vacía y por la puerta real. Pero esta vez **no puede cortarse en el paso 6 ni en el 9**:

1. Arrancar. Leer la clave del recuadro.
2. Entrar como administrador. Cambiar la clave.
3. Dar de alta a un `generador`. **Leer su clave de la pantalla.**
4. Salir. Entrar con ese operador. Cambiar la clave.
5. **Requerimiento completo**: título, año, dependencia, justificación, **tres renglones del catálogo**.
6. **Subir dos presupuestos por la pantalla.** Es donde se cortó la ronda pasada (H1). Con archivos de verdad: un PDF chico, uno de más de 2 MB que debe rechazarse con un mensaje en castellano, y algo que no sea PDF ni imagen.
7. Guardar. **Generar el documento y exportar el archivo del pliego**, y correr el generador real.
8. **Llenar el ANEXO 1 por la pantalla, guardarlo, cerrar el expediente, volver a abrirlo, y verificar que los datos estén.** Es lo que nunca funcionó (H2+H3). Si al abrir el expediente desaparece la aplicación, es H2 sin corregir.
9. Salir, entrar con un `abastecimiento`, **avanzar el expediente** por el botón que ve esa persona.
10. Seguir con los roles que haya hasta donde llegue el circuito.
11. **Salir.** Tiene que quedar **una** pantalla de ingreso, limpia (H4).

**La regla:** si en cualquier paso tenés que invocar algo a mano, saltear una pantalla, o usar la API en lugar del botón, **eso es el hallazgo**. Anotá el paso exacto y seguí desde ahí.

El reporte lleva la secuencia **paso por paso con lo que viste en cada uno**, no un resumen.

---

## 3. El número · y esta vez comparalo con el anterior

Volvé a contar los nueve caminos y cuántos tienen test que los recorre entero **sin ayuda**.

La orden pide llegar a **6 de 9** (C1, C2 completo, C3, C4, C5, C8). Verificá **uno por uno**, y para cada uno que el desarrollador declare cubierto:

- **Quitá la corrección que lo sostiene y comprobá que el test se ponga en rojo.** Un test que pasa igual no cubre nada.
- **Leé cómo arranca.** Si llama a mano a una función de vista, no está cubierto, aunque diga que sí.

Si el número que te da es menor que el declarado, **ése es el hallazgo principal de la ronda**.

---

## 4. Las tres listas que la orden pide · hacé la tuya antes de leer la suya

La orden le pidió tres barridos. **Hacé los tres por tu cuenta primero**, y después compará. Lo que esté en la tuya y no en la suya es el hallazgo:

- **Funciones del repositorio falseadas** en las monturas. Fue lo que escondió H1 durante ciclos.
- **Vistas que reciben la raíz** (`<main id="app">`) y pueden esconderla. Fue H2.
- **Vistas que escriben sobre nodos por identificador**, y cuáles **no fallan** cuando el nodo no existe. Fue H3 — y la orden pide que ahora fallen de forma visible, ADR-029 aplicado al DOM. **Probalo**: sacale un identificador al HTML y verificá que la vista proteste en lugar de seguir en silencio.

---

## 5. Los nueve tests del asistente

La orden pide reescribirlos o eliminarlos. La ronda pasada no se hizo ninguna de las dos cosas.

- **Ninguno puede seguir llamando a mano** a `wizard.seleccionarOperador`.
- Por cada reescrito: quitá la corrección y verificá que falle.
- Por cada eliminado: ¿se perdió alguna verificación que valía?
- Y los del linaje largo —`expediente`, `expediente-matriz`, `exportar`, `ronda-13`, `kanban`—: la orden pide **marcarlos**, no reescribirlos. Verificá que estén marcados y anotados en el plan.

---

## 6. Regresiones

Todo lo anterior, con la batería completa. Con atención especial a lo que cerró la ronda 19, porque esta toca el arranque de las vistas y el montaje:

- El operador llega al asistente; el borrador se guarda y sobrevive al reinicio.
- La clave provisoria en pantalla, en el alta, la importación y la reposición.
- El arranque honesto, la marca de administrador, `activo` con su vocabulario, el anti-encierro sobre el estado final.
- Publicar sin probar, las cinco variantes.
- Bienes y servicios contra el generador real.

---

## 7. El reporte — `AUDITORIA-CICLO-20.md`

Misma estructura. Cinco secciones propias:

```
## El recorrido completo, los once pasos
Qué vi en cada uno. Y dónde se cortó, si se cortó.

## El número, contra el anterior
9 caminos. Cuántos cubiertos de verdad, verificados quitando la corrección.

## Mis tres listas contra las suyas
Repositorios falseados, vistas con la raíz, nodos inexistentes.

## Los nueve tests
Reescritos, eliminados, o ninguna de las dos.

## ¿Se puede instalar?
Tu recomendación, en una línea, con lo que la sostiene.
```

Cierre: un solo commit, `Auditoria ciclo 20`, sin push.

---

## 8. Qué se espera de vos

Lo mismo que la vez pasada, que salió bien: **manejá el sistema antes de leerlo**.

Con una diferencia. La ronda 19 te pidió recorrer el circuito y **se cortó dos veces** — y eso ya fue un resultado. Esta vez la pregunta es más dura, porque el circuito debería llegar hasta el final:

**¿Puede una persona sola cargar un requerimiento completo, generar su documento, llenar el ANEXO 1, y pasárselo al que sigue — sin que vos tengas que ayudarla ni una sola vez?**

Si la respuesta es sí, el Jefe de Contrataciones lo prueba esa misma semana. Si es no, quiero saber exactamente en qué paso y con qué en la pantalla.
