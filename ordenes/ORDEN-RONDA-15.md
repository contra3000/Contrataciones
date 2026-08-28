# ORDEN DE TRABAJO — RONDA 15

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H10 (parcial) — Paquete de despliegue y arranque como servicio**, más la corrección del ciclo 14
Emitida: 2026-08-29

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

**El ciclo 14 cerró el punto por donde pasa todo lo demás.** El rol viene de la sesión y el `contexto` del cuerpo **se reemplaza, no se compara** — el auditor probó nueve formas de actuar como otra persona contra el servidor real y ninguna funcionó. La jerarquía quedó como dato, sin duplicar la matriz. La clave provisoria cierra los catorce extremos. Y el padrón no deja una sola clave en claro en ningún archivo de la carpeta de datos.

Dos decisiones tuyas que quiero nombrar:

1. **Reemplazar el contexto en vez de compararlo** es la diferencia entre cerrar el problema y mitigarlo. Si el servidor lo leyera para compararlo, seguiría leyendo un dato que elige el cliente.
2. **El alta masiva es todo o nada, y dice qué línea falló.** Aceptar a medias un padrón hubiera sido la peor de las opciones posibles.

### Y una noticia que cambia el proyecto

**Informática autorizó una máquina virtual propia.** Proxmox, **Debian 12**, sobre un Ryzen 5 con 16 GB de RAM y unos 8 GB libres. Se pueden subir archivos y actualizar la versión de la aplicación sin trámite. **Leé ADR-035 completa antes de empezar.**

Lo que más te toca: **la carpeta de datos ya no va en una carpeta de red compartida. Va en el disco de esa máquina.** La escritura atómica y el bloqueo de numeración que escribiste en la ronda 3 pasan a correr sobre un sistema de archivos local, que es donde son fiables de verdad.

Y como la intranet es una sola LAN, **esto se va a instalar en un equipo de la red apenas termines esta ronda.** Lo que entregues acá es lo que va a estar corriendo cuando los operadores lo prueben.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Alcance

**Que esto se pueda instalar y quede corriendo solo.**

Es una ronda de menos código que las anteriores y más consecuencia: al terminarla, la aplicación deja de ser algo que se arranca a mano en una consola y pasa a ser un servicio que levanta con la máquina.

**Fuera de alcance:** las plantillas del pliego (H20, ronda 16) y el UAT (ronda 17).

---

## 2. Corrección · el padrón está en dos lugares

`servidor.js` lee el padrón **una sola vez al arrancar**, y ese retrato es el que consulta la autorización en cada transición. Las sesiones, en cambio, se construyen del padrón vivo al ingresar.

Consecuencias, las dos reproducidas por el auditor:

- **Una baja no corta una sesión abierta.** Un operador dado de baja siguió avanzando expedientes con la cookie que ya tenía. Su ingreso nuevo daba `401`, pero el que ya estaba adentro siguió.
- **Si el servidor arranca antes de que exista el padrón real**, el retrato queda con el de ejemplo: los operadores reales ingresan pero **toda transición devuelve `403`**. Falla cerrado, no es una fuga — pero pasaría exactamente el primer día de instalación, que es la semana que viene.

**Es la misma clase de defecto que ADR-029 y que el emisor de YAML: un dato que existe en dos lugares y puede divergir.** Vamos tres, así que corregilo como clase:

- **Una sola fuente de verdad para el padrón**, leída en el momento en que se la necesita. No dos.
- **Una sesión abierta se revalida contra el padrón vigente** en cada petición: si el operador está inactivo, bloqueado, o su rol cambió, **la sesión lo refleja** — se corta, o se degrada al rol nuevo.
- **Y buscá la misma forma en otro lado**: cualquier otro dato que se lea una vez al arrancar y después se consulte del retrato. Si hay más, decilo.

No hace falta releer el archivo en cada petición si eso pesa; alcanza con una carga con detección de cambio. Lo que no puede quedar es que un cambio en el padrón **no tenga efecto**.

---

## 3. El paquete de despliegue · H10-2

Para **Debian 12**, que es lo que corre la máquina virtual.

### 3.1 — Qué se instala

`app/`, `server/`, `tools/`, `config/` y el catálogo. **`tests/`, `datos-prueba/` y las órdenes no van al paquete**: lo que se despliega es lo que se usa.

Un `instalar.sh` que:

- crea un **usuario de sistema propio** para el servicio, sin sesión de consola;
- crea la **carpeta de datos** con ese usuario como dueño y **sin permiso de escritura para nadie más** — es ADR-015, ahora cumplible de verdad;
- deja los archivos de la aplicación **de sólo lectura** para el usuario del servicio: el proceso no tiene por qué poder modificar su propio código;
- **no pisa la carpeta de datos si ya existe.** Instalar dos veces no puede borrar expedientes.

### 3.2 — La versión de Node

**Node 18, el de los repositorios de Debian 12.** No pidas una versión más nueva: no la necesitás y agregar un repositorio externo es una discusión que no hace falta dar.

Declará la **versión mínima** en un solo lugar y verificala al arrancar (§3.4). Si algo del código no corre en 18, decilo en el informe **y cambiá el código, no el requisito.**

### 3.3 — Servicio de systemd

- Arranca al iniciar la máquina.
- **Se reinicia solo si se cae**, con una espera entre intentos.
- Escribe su salida al registro del sistema, no a un archivo que nadie rota.
- Corre como el usuario del punto 3.1, **nunca como root**.
- El puerto y la carpeta de datos salen de un archivo de configuración, **no del archivo del servicio**: cambiar el puerto no puede exigir editar la unidad de systemd.

### 3.4 — Verificación de arranque · **y esto es lo que más importa de la ronda**

Antes de escuchar en el puerto, el servidor comprueba:

1. que la **carpeta de datos exista y sea escribible** por él —escribiendo y borrando un archivo, no consultando permisos—;
2. que **exista el padrón** y tenga al menos un operador con credencial;
3. que la **versión de Node** alcance;
4. que el **catálogo** esté presente y su manifiesto sea legible;
5. que el **puerto esté libre**.

**Si algo falta, no arranca**, y el mensaje dice **qué falta y qué hacer** — en castellano, en una línea, sin rastro de pila.

La razón es concreta: el problema del §2 se manifiesta como *"la aplicación anda pero todo da 403"*. Un servidor que arranca a medias y falla raro es mucho peor que uno que no arranca y explica por qué.

### 3.5 — Actualizar la versión

Un procedimiento de cinco pasos que **cualquiera pueda seguir**: subir, parar el servicio, reemplazar los archivos de la aplicación, arrancar, verificar. Con **la vuelta atrás en un comando**: la versión anterior queda guardada y se restaura sin tocar los datos.

**Los datos nunca se tocan al actualizar.** Ni al instalar, ni al actualizar, ni al volver atrás.

### 3.6 — El respaldo, ahora que hay dónde

El respaldo diario ya existe (H3-8). Lo que falta es **que corra solo** —una tarea programada del sistema— y que **el destino sea configurable**: la idea es que escriba a `Y:` o a otra ruta de red, para que la copia no viva en el mismo disco que el original.

Si el destino no está disponible, **el respaldo avisa y no borra el anterior.** Un respaldo que falla en silencio es peor que ninguno, porque nadie lo mira hasta que hace falta.

### 3.7 — El instructivo, de una página

Para Informática y para quien administre esto dentro de dos años: qué instalar, qué puerto, cómo se arranca y se para, cómo se actualiza, cómo se restaura, y qué mirar cuando algo no anda. **Una página. En castellano. Sin suponer que el lector conoce el proyecto.**

---

## 4. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. Una **baja** corta o degrada una sesión ya abierta, verificado con la cookie previa contra el servidor.
2. Un **cambio de rol** en el padrón se refleja en una sesión abierta.
3. El servidor **no arranca** si falta la carpeta de datos, si falta el padrón, si el catálogo no está, o si la versión de Node no alcanza — y el mensaje dice qué falta, uno por uno.
4. El servidor **sí arranca** cuando están las cuatro cosas.
5. `instalar.sh` **no pisa** una carpeta de datos existente.
6. El procedimiento de actualización **no toca los datos**: expedientes, padrón, eventos y sugerencias intactos antes y después.
7. La vuelta atrás restaura la versión anterior y **deja los datos como estaban**.
8. El respaldo **avisa y no borra el anterior** si el destino no está disponible.
9. La suite completa termina en verde de una sola pasada.

---

## 5. `INFORME-RONDA-15.md` — las nueve secciones

En la §2, tres cosas explícitas:

- **cómo quedó la fuente de verdad del padrón**, y si encontraste otro dato con la misma forma;
- **qué comprueba el arranque** y qué mensaje da cada caso;
- **qué se lleva el paquete y qué no**, y por qué.

Y en la §6, algo que necesito de vos y no puedo verificar solo: **qué puede salir mal el día de la instalación.** Sos el que conoce el código; decime dónde mirarías primero.

---

## 6. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. Documentación de sólo lectura: **ADR-021 a ADR-035**, las órdenes y `referencias/`.

```
node --test
node tools/check-compat.js
git add -A
git commit -m "Ronda 15 - Paquete de despliegue, servicio y padron vivo"
git push
git log --oneline -1
git status --short
git log origin/main --oneline -1
```

---

## 7. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en clon limpio, una pasada | Verde |
| 2 | `check-compat` | Salida 0 |
| 3 | Padrón | **Una sola fuente de verdad**; la baja corta la sesión abierta |
| 4 | Cambio de rol | Se refleja en una sesión abierta |
| 5 | Arranque | **No arranca** si falta algo, y dice qué |
| 6 | `instalar.sh` | No pisa datos existentes; usuario propio; datos sólo escribibles por el servicio |
| 7 | Servicio de systemd | Arranca con la máquina, se reinicia solo, no corre como root |
| 8 | Puerto y carpeta de datos | Desde configuración, no desde la unidad de systemd |
| 9 | Actualización | No toca los datos; vuelta atrás en un comando |
| 10 | Respaldo | Destino configurable; avisa y no borra el anterior si falla |
| 11 | Node 18 | La aplicación corre con el de Debian 12 |
| 12 | Instructivo | Una página, en castellano, sin suponer contexto |
| 13 | Archivos sobre 400 líneas | Ninguno |
| 14 | Informe con las nueve secciones | Completo |

---

## 8. Qué se está evaluando

**Que esto sobreviva a la instalación y al lunes siguiente.**

Catorce rondas construyeron un sistema que funciona cuando alguien lo arranca a mano en una consola con todo en su lugar. Esta ronda tiene que hacerlo funcionar cuando **nadie está mirando**: después de un reinicio, después de una actualización, con el disco lleno, sin el padrón, con el catálogo a medias.

Pesa, en este orden: (1) que el padrón tenga una sola fuente de verdad, (2) que el arranque no arranque a medias, (3) que actualizar no toque los datos, (4) que el servicio levante solo, (5) el instructivo.

El punto 2 es el que va a evitar la peor tarde posible: la de instalarlo, ver que "anda", y descubrir a las dos horas que todas las transiciones daban 403 porque el padrón no estaba cuando el servidor arrancó.
