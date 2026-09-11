# ORDEN DE AUDITORÍA — CICLO 19

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **el cierre de H22 — que el circuito de la persona funcione de punta a punta**, según `ordenes/ORDEN-RONDA-19.md`
Emitida: 2026-09-11

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, `MOTIVOS.md` al día, y la integridad de la bitácora sobre **38 ADRs**.

### Tu ciclo anterior, y lo que se te pasó

El ciclo 18 lo hiciste bien: los cuatro altos cerrados y verificados, el recuadro comprobado mirando y no midiendo, la importación reventada con archivos de verdad. Dijiste "sí, se puede instalar", y sobre lo que auditaste, tenías razón.

**Y sin embargo el sistema estaba roto en su función principal.**

Tres días después, el Jefe de Contrataciones lo prendió, entró con su cuenta, e intentó cargar un requerimiento real. No pudo. Después intentó crear un operador para probar otro rol. Tampoco. En dos intentos, sin herramientas y sin leer una línea de código, encontró **tres defectos que bloquean todo** y que ni el desarrollador ni vos habían visto:

| Defecto | Consecuencia |
|---|---|
| `operadorSeleccionado()` no le avisa al asistente quién entró | **En modo autenticado nadie puede crear un expediente**, con ningún rol |
| Lo mismo hace que `estado.operador` quede en `null` | **No se guarda ningún borrador**, nunca |
| Las claves generadas se devuelven y la pantalla las descarta, en las tres puertas | **Nadie salvo el administrador puede entrar al sistema.** Jamás |

Ninguno es sutil. Los tres se encuentran **usando el sistema**.

**Por qué no los encontraste, y esto es lo único que importa de esta orden:** auditaste el servidor, la API, los permisos, los archivos y los bordes — todo por separado, y todo bien. **No recorriste el camino de una persona de principio a fin.** Y los tests tampoco: los nueve del asistente le ponen el operador a mano antes de empezar, así que dan verde sobre una función que la aplicación no puede alcanzar.

Es la segunda vez que aparece esta forma. La primera fue tu propio hallazgo del ciclo 16 —el probador de plantillas fabricando dos campos que la exportación real nunca emitía— y lo llamaste, con razón, la clase de cosa que justifica que existas como agente separado. **Volvió, del otro lado, y esta vez te pasó a vos.**

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## Reglas de tiempo · **léelas antes de ejecutar el primer comando**

*Pedido expreso del Jefe de Contrataciones, 2026-09-11: deja la máquina trabajando sin nadie delante, y en varias rondas se encontró con procesos colgados y horas perdidas.*

**Ningún comando corre "hasta que termine". Todos llevan un tiempo máximo explícito.** Si se vence, el proceso se mata, se anota, y se sigue.

### Los topes

| Qué | Tope | Si se vence |
|---|---|---|
| Arrancar un servidor y comprobar que responde | **60 s** | Matarlo y anotar. No reintentar más de una vez |
| Una petición HTTP suelta | **15 s** | Anotar la ruta y seguir |
| La suite de tests completa | **600 s** | Matarla, anotar hasta qué archivo llegó, y correr el resto por partes |
| Un archivo de tests suelto | **120 s** | Matarlo y anotar cuál |
| La batería adversaria completa | **900 s** | Igual que la suite |
| El generador de pliegos (`python`) | **120 s** | Matarlo y anotar el expediente que lo colgó |
| Una importación o carga de archivo grande | **180 s** | Matar y anotar el tamaño |
| **Cualquier otro comando** | **300 s** | Matar y anotar |

### Tres reglas que no se negocian

**1 · El que enciende, apaga.** Todo servidor que arranques lo matás vos, en el mismo paso, aunque el paso haya fallado. Guardá el identificador del proceso al arrancarlo y usalo para matarlo. **No puede quedar ningún proceso vivo al terminar la ronda** — si queda uno escuchando en un puerto, la ronda siguiente arranca rota y nadie entiende por qué.

**2 · Un tope vencido es un hallazgo, no un accidente.** Va al informe con el comando exacto, el tope, y cuánto tardó. **Un reintento como máximo**, y si vuelve a vencer, se abandona ese punto, se escribe en *"qué NO hice"* y **se sigue con el siguiente**. Está prohibido reintentar en círculo.

**3 · La ronda siempre termina con commit e informe, aunque esté incompleta.** Reservá el final para cerrar. Si llevás **más de quince minutos trabados en el mismo punto**, abandonalo, anotalo, y pasá al siguiente. **Media ronda entregada vale infinitamente más que una ronda completa que nadie recibió**, y ya nos pasó: en el ciclo 10 se hizo el trabajo entero y se perdió por no cerrarlo.

### Cómo se hace, en concreto

**PowerShell** — arrancar el servidor con tope y matarlo siempre:

```powershell
$p = Start-Process node -ArgumentList 'server\servidor.js','--config','...' -PassThru
try {
  # ... la prueba, con su propio tope ...
} finally {
  if (!$p.HasExited) { Stop-Process -Id $p.Id -Force }
}
```

Un comando cualquiera con tope:

```powershell
$j = Start-Job { node tests\correr.js }
if (Wait-Job $j -Timeout 600) { Receive-Job $j } else { Stop-Job $j; 'TOPE VENCIDO: tests' }
Remove-Job $j -Force
```

**Node** — si lanzás desde un script:

```js
const hijo = spawn(cmd, args);
const reloj = setTimeout(() => hijo.kill('SIGKILL'), 600000);
hijo.on('exit', () => clearTimeout(reloj));
```

### Y lo que nunca se hace

- **Ningún comando que espere el teclado.** Nada de `pause`, nada de un editor interactivo, nada de un `prompt` de consola. Si una herramienta pregunta algo, se le pasa la respuesta por argumento.
- **Ningún proceso en segundo plano que sobreviva al paso.** Si lo arrancaste, lo matás.
- **Ningún `git` sobre la carpeta montada sin tope**: `git status` ahí se cuelga y devuelve vacío, que se lee igual que "todo limpio" (§3.6 del ciclo de trabajo). Miralo con tope y **controlá el código de salida**: `124` no es `0`.

> **Para vos vale doble**: sos el que arranca servidores, corre la batería entera y ejecuta el generador real. De los dos, el que más procesos enciende sos vos.

---

## 1. Verificación de conducta

Los ocho de siempre, y **la batería completa**, con `MOTIVOS.md` actualizado.

Y uno nuevo de esta ronda: **el informe va en la raíz del repositorio**, como `INFORME-RONDA-19.md`. El de la ronda 18 quedó en `ordenes/`. Es menor y se corrige diciéndolo.

---

## 2. El recorrido completo · **el 50% de esta auditoría**

Esto va primero, ocupa la mitad, y se hace **antes** de mirar ninguna otra cosa.

### 2.1 — El circuito, entero, sin ayudarte

Sobre una **carpeta de datos vacía**, con el servidor arrancado como lo arrancaría una persona:

1. Arrancar. Leer la clave del recuadro **de la salida**, no del código.
2. Entrar como administrador con esa clave. Cambiarla.
3. **Dar de alta a un operador `generador` desde la pantalla.**
4. **Leer su clave provisoria de la pantalla.** Si no está en la pantalla, el defecto sigue vivo, sin importar lo que devuelva la API.
5. **Salir. Entrar con ese operador.** Cambiar la clave provisoria.
6. **Crear un requerimiento completo**: título, año, dependencia, justificación, tres renglones del catálogo, dos presupuestos. **Guardarlo.**
7. Generar el documento y exportar el archivo del pliego.
8. Salir, entrar con un `abastecimiento`, y **hacerle avanzar el expediente al paso siguiente**.
9. Y así hasta donde llegue el circuito con los roles que haya.

**La regla de esta sección:** si en cualquier paso tenés que invocar una función de vista a mano, saltear una pantalla, o armar un dato que la aplicación debería armar sola, **eso es el hallazgo**. Anotalo con el paso exacto y seguí desde ahí.

Escribí el recorrido **paso por paso, con lo que viste en cada uno**. No un resumen: la secuencia.

### 2.2 — Lo mismo, importando el padrón

Repetir desde el paso 3 pero **importando `PADRON_INICIAL.csv`** en lugar de dar de alta a uno:

- ¿Aparecen **las catorce claves** en pantalla?
- ¿Se pueden copiar de una sola vez, en un formato que sirva para imprimir y repartir en mano?
- **Tomá tres al azar y entrá con las tres.**

### 2.3 — Los borradores, que hoy no existen

Cargar medio requerimiento, recargar la página, y verificar que **el borrador se ofrezca**. Después: cargar medio requerimiento y **matar el servidor**; volver a arrancarlo; ¿está?

Hoy no se guarda ninguno, en ningún caso, porque el asistente nunca supo quién era el operador. Verificá que ahora sí — y verificá también que el borrador de una persona **no se le ofrezca a otra**.

---

## 3. Los tests · auditá la suite, no sólo el código

Es la parte nueva de tu trabajo y la que esta ronda incorpora de forma permanente.

### 3.1 — Los nueve del asistente

La orden pide reescribirlos para que entren por la puerta real, y eliminar los que no se puedan reescribir.

- **Verificá que ninguno siga llamando a `wizard.seleccionarOperador` a mano.**
- Por cada uno que dice haber reescrito: **quitá la corrección del código** (la llamada que falta en `operadorSeleccionado`) **y verificá que el test falle.** Si pasa igual, no se reescribió: se maquilló.
- Por cada uno que dice haber eliminado: ¿se perdió alguna verificación que valía? Si se perdió, decilo.

### 3.2 — El barrido, que es lo que importa

Recorré **la suite entera** buscando la misma forma: tests que inicializan una vista llamando a algo que la aplicación no llama sola, y después afirman que el circuito funciona.

El criterio de la orden:

- **Legítimo** — un test unitario que le pasa una entrada a una función y verifica su salida.
- **No legítimo** — un test que arma el estado de una vista a mano y concluye que el circuito anda.

**Hacé tu propia lista antes de leer la del desarrollador**, y después compará. Lo que esté en la tuya y no en la suya es el hallazgo.

Y la pregunta de fondo, que quiero contestada con un número: **¿cuántos caminos de persona tiene el sistema, y cuántos tienen un test que los recorre entero sin ayuda?**

---

## 4. Las correcciones puntuales

- **La clave en el alta**: ¿queda en pantalla hasta que se la cierra? ¿se puede seleccionar? ¿el botón de copiar funciona? ¿sobrevive a un refresco de la lista?
- **La clave en la importación**: las de todos los creados, con "copiar todo".
- **La clave en la reposición**: la orden pide que no pase por `accion()`. Verificá que no pase — y si `accion()` sigue descartando respuestas de otras acciones, revisá si alguna otra tenía algo que mostrar.
- **El formulario del alta**: cinco campos a la vista, rol como lista desplegable con los roles de `config.js`, y **cancelar no pierde lo tipeado**. Probá el error: un correo inválido no puede borrar los otros cuatro campos.
- **El selector de archivo de la importación**: elegir un `.csv` del disco. Y que **siga existiendo** la opción de pegar texto. El resto del flujo —previsualización, confirmación con los nombres, todo o nada— **ya estaba bien: verificá que no se haya roto.**

---

## 5. Regresiones

**Todo lo anterior**, con la batería completa. Y con atención especial a lo que se cerró en la ronda 18, porque esta ronda toca el arranque de las vistas:

- El arranque honesto: sin bloque `administrador` no arranca; con padrón existente sí.
- La marca de administrador gobernando el compendio.
- `activo` con su vocabulario cerrado, y el anti-encierro sobre el estado final.
- Publicar sin probar, las cinco variantes.
- El pliego de bienes y el de servicios, contra el generador real.

---

## 6. El reporte — `AUDITORIA-CICLO-19.md`

Misma estructura. Cuatro secciones propias:

```
## El recorrido completo, paso por paso
Los nueve pasos, con lo que vi en cada uno. Y dónde se cortó, si se cortó.

## Las catorce claves
Qué mostró la importación, y con cuáles pude entrar.

## Los tests que probaban una ficción
Los nueve, uno por uno. Y los que encontré yo barriendo la suite.

## ¿Cuántos caminos de persona están cubiertos?
El número, y cuáles no lo están.
```

Cierre: un solo commit, `Auditoria ciclo 19`, sin push.

---

## 7. Qué se espera de vos

Una sola cosa, y es un cambio de método, no de esfuerzo.

**Hasta ahora auditaste el sistema por partes: el servidor, la API, los permisos, los archivos, los bordes. Todo eso está bien hecho y hay que seguir haciéndolo. Pero ninguna de esas partes es donde vive el sistema.**

El sistema vive en el camino que recorre una persona desde que prende la máquina hasta que firma un papel. Ese camino **no lo recorrió nunca nadie**, ni vos ni el desarrollador ni los tests — y por eso estuvo tres días roto en su función principal mientras 390 pruebas daban verde y una auditoría decía que se podía instalar.

La pregunta que guía esta auditoría: **¿puede una persona, sola, hacer su trabajo de principio a fin con este sistema?**

Contestala recorriéndolo, no leyéndolo.
