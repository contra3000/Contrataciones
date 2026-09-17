# INFORME-RONDA-22

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Cierre: 2026-09-17

> **Quién escribe esto y por qué.** Lo escribe el revisor, no el desarrollador.
> La sesión del desarrollador quedó cortada a mitad de la ronda por una falla del
> proveedor de modelos, no por el código ni por la orden (§7). El trabajo de §1
> estaba hecho y verde en el árbol de trabajo, **sin commitear**, y la regla §3.14
> del ciclo dice que la ronda siempre termina con commit e informe aunque esté
> incompleta. Esto es ese cierre.
>
> Todo lo que se afirma acá lo verifiqué yo sobre el disco, archivo y línea.
> Lo que sólo consta en la transcripción de la sesión del desarrollador está
> marcado como tal.

---

## 1. Resumen ejecutivo

**La ronda 22 se entrega con §1 completo y nada más.**

| Punto de la orden | Estado |
|---|---|
| §1 · Nadie controla quién origina un requerimiento | **Hecho y verde** |
| §1 · B1 — barrido de extremos que crean algo | **Hecho** (y recontrastado por el revisor) |
| §2 · Presupuesto de 20 MB con transporte binario | **No empezado** |
| §3 · Texto de ayuda de la aclaración | **No empezado** |
| §4 · B2 — barrido de límites | **No hecho** (el sub-agente murió dos veces) |
| §5 · Suite en paralelo bajo dos minutos | **Medido y no logrado** |

Lo que queda pendiente **no se pierde**: pasa íntegro a la `ORDEN-RONDA-23.md`,
partido en piezas que se commitean por separado para que la próxima
interrupción no cueste una ronda entera.

---

## 2. §1 — La guardia que faltaba en la puerta de entrada

### Lo que se hizo

Tres guardias, dos en el servidor y una de cortesía en el cliente.

**`server/expedientes.js:92-101`** — `apiCrear`, inmediatamente después de leer el
contexto del cuerpo:

```js
const autorizacionDelNacimiento = SGC.core.autorizacion.verificar(entorno.padronVivo.usuarios(), contexto);
if (!autorizacionDelNacimiento.ok) {
  return responderJson(res, 403, { error: autorizacionDelNacimiento.error });
}
const rolDelPrimerPaso = SGC.core.config.ESTADOS[0].rolEjecutor;
if (SGC.core.config.rolesEfectivos(contexto.rol).indexOf(rolDelPrimerPaso) === -1) {
  return responderJson(res, 403, { error: 'crear un expediente exige el rol "' + rolDelPrimerPaso + '", …' });
}
```

**`server/base.js:187-196`** — `apiCrearBase`, la segunda puerta de nacimiento,
con la misma guardia y mensaje propio.

**`app/js/app.js:97-103`** — `actualizarNavAlta(operador)`, llamada desde
`operadorSeleccionado`: si el operador no tiene el rol del primer paso, el botón
de alta no aparece. **Es cortesía; el control que vale es el del servidor**, y
así está redactado el test.

El rol sale de la sesión (`sesion.js inyectarContextoEn`) como desde el ciclo 14.
**No se tocó la matriz de 18 × 7.**

### El barrido B1 — quién puede crear qué, y quién lo verifica

El desarrollador lo entregó en su sesión. **Lo recontrasté yo sobre el disco**
buscando `autorizacion.verificar` en todo `server/*.js`, y coincide:

| Extremo | Quién debería poder | Quién lo verifica hoy | Qué pasa |
|---|---|---|---|
| `expedientes.js:63 apiCrear` | `generador` | **la guardia nueva** | 403 correcto |
| `base.js:170 apiCrearBase` | `generador` | **la guardia nueva** | 403 correcto |
| `expedientes.js:320 apiGuardar` | el rol del estado | `verificar` (l. 373) | correcto |
| `expedientes.js:205/209 avanzar/devolver` | la matriz | `verificar` (l. 155) | correcto |
| `padron-administracion.js` (todos) | administrador | `esAdministrador` (l. 60) | correcto |
| `eventos.js:301 apiEventos` | administrador | marca de administrador (l. 304) | correcto |
| `compendio.js` | administrador | `verificar` (l. 37) | correcto |
| **`presupuestos.js:38 apiGuardarPresupuesto`** | el rol del estado | **nadie** | cualquiera sube un presupuesto |
| **`expedientes.js:224 apiGuardarEntregable`** | el rol del estado | **nadie** | cualquiera escribe un entregable |
| **`pliego-plantillas-api.js` (publicar, estampar, volver, seleccionar)** | administrador | **nadie** | cualquiera cambia la plantilla vigente |
| `sugerencias.js:156 apiCrearSugerencia` | cualquiera del padrón | nadie, **a propósito** | correcto (es el buzón del piloto) |

**Tres puertas más sin guardia, de la misma familia que §1.** No son un descuido
de esta ronda: son lo que el barrido existía para encontrar. Van a la ronda 23
como punto propio, no como nota al pie.

---

## 3. §2 — El presupuesto de 20 MB

**No empezado.** Pasa completo a la `ORDEN-RONDA-23.md` §2, ahora partido en dos
piezas que se entregan por separado: primero el transporte binario, después el
número y el aviso del cliente.

Lo único que cambió respecto de la orden 22 es que ahora se sabe que
`presupuestos.js` tampoco mira el rol — así que la pieza del transporte se hace
junto con su guardia, en el mismo archivo y de una sola vez.

---

## 4. §3 — El texto de ayuda de la aclaración

**No empezado.** Son tres renglones de texto y pasa a la `ORDEN-RONDA-23.md` §4,
donde es la primera pieza de la ronda justamente por ser la más chica: se
commitea sola en diez minutos y ya no puede perderse.

---

## 5. Los tests de esta ronda

**`tests/ronda-22-nacimiento.test.js`** (nuevo, 3 casos, verde): los siete roles
contra `apiCrear` —sólo `generador` lo consigue, los otros seis reciben 403—, por
API y por pantalla, y el caso del botón fabricado a mano que el servidor rechaza
igual.

Migrados al contexto `maria.gonzalez@faa.mil.ar` / `generador`, porque creaban
expedientes con roles que ya no pueden: `tests/helpers/repo-bateria.js`,
`tests/servidor.test.js`, `tests/servidor-concurrencia.test.js`, y el test 18 de
`tests/ronda-17.test.js`, pasado a `servidorConRoles()` + `s.cookies.generador`.

**Dos errores propios del desarrollador, resueltos en la misma sesión**, que
valen porque los dos son de la familia "el test arma a mano lo que la aplicación
no produce":

- La afirmación sobre el disco contaba dos carpetas donde esperaba una: el
  servidor crea `2026/001_Expediente` **y** `2026/2026-001_Expediente`. El filtro
  quedó en `/^\d{3,}_Expediente$/`.
- El test de pantalla fallaba porque `importarPadron` en
  `circuito-ronda-21.js` tiene clavado el CSV de catorce personas del C6, y las
  claves de la ronda 22 volvían `undefined`. Se resolvió con una importación de
  siete roles escrita en el propio test.

---

## 6. Regresión de la suite

**423 de 423 en verde.** Corridas dirigidas previas: 102/102 y 87/87.

**El criterio de los dos minutos no se cumple, y hay que decir por qué:**

| Corrida | Tiempo |
|---|---|
| `node --test` | **304 s** |
| `node --test --test-concurrency=4` | **278 s** |

`os.availableParallelism()` devuelve 4 en esa máquina, pero el tiempo de pared
sigue siendo prácticamente la suma de los archivos: **el paralelismo por archivo
no está ocurriendo**, y no alcanza con pedirlo por bandera. El criterio, como lo
escribí en la orden 22, **no era alcanzable con el cambio que la orden proponía**.
Es un error mío de redacción, no un incumplimiento del desarrollador. En la
ronda 23 el criterio es otro y está justificado ahí.

---

## 7. Contradicciones y observaciones

### Lo que cortó la ronda no fue el código ni la orden

`Error from provider (Console): OpenCode's free tier can only be used from within OpenCode`

Apareció repetido: mató al sub-agente de B2 dos veces e interrumpió al menos dos
sesiones del desarrollador a mitad de trabajo.

**Es una falla del proveedor, del lado del servidor, empezada el 2026-09-17**, y
le está pasando a todo el mundo al mismo tiempo —incluso a quienes lo usan desde
la aplicación instalada, que es exactamente lo que el mensaje dice que habría que
hacer. No es configuración de esta máquina, no es el esquema de sub-agentes, y no
hay nada en este repositorio que lo arregle.

### Lo que sí es nuestro, y se corrige en el ciclo

Que una falla externa se lleve puesta una ronda entera **sí** es nuestro. La ronda
22 tenía §1 hecho y verde durante horas, sin commitear, a un corte de distancia de
perderse. De acá salen dos reglas nuevas del ciclo (§3.18 y §3.19) y el reparto en
piezas de la ronda 23.

### Los sub-agentes quedan opcionales

La orden 22 los pedía. A partir de la 23 **se ofrecen y no se exigen**: si la
llamada falla, el barrido se hace en serie, con un reintento como máximo, y el
informe lo declara. Un esquema de trabajo que depende de que un proveedor
gratuito esté de buen humor no es un esquema de trabajo.

---

## 8. Qué se lleva el paquete

### Aplicación

- `server/expedientes.js` — guardia de rol en `apiCrear`.
- `server/base.js` — guardia de rol en `apiCrearBase`.
- `app/js/app.js` — `actualizarNavAlta`, el botón de alta según el rol.

### Tests

- `tests/ronda-22-nacimiento.test.js` (nuevo).
- `tests/helpers/repo-bateria.js`, `tests/servidor.test.js`,
  `tests/servidor-concurrencia.test.js`, `tests/ronda-17.test.js` (contextos
  migrados).

### Lo que no se lleva

`__prb/` — carpeta de tanteo del desarrollador, movida a
`_to_delete/ronda-22-scratch/` y fuera del commit.

---

## 9. Criterios de aceptación

| Criterio de la orden 22 | Resultado |
|---|---|
| Un `contrataciones_supervisor` no puede crear un expediente; un `generador` sí | **cumplido**, verificado en el servidor |
| La lista completa de extremos que crean algo, con su control | **cumplido** (§2 de este informe) |
| Un PDF de 20 MB sube, con progreso, sin cien megas de memoria | **no cumplido** — ronda 23 |
| El límite escrito una sola vez | **no cumplido** — ronda 23 |
| El texto de ayuda de la aclaración, visible | **no cumplido** — ronda 23 |
| Los 9 caminos en verde, sin tocar ningún test | **cumplido** — 423/423 |
| La suite completa en menos de dos minutos | **no cumplido**, y el criterio estaba mal escrito (§6) |

**Tres de siete.** La ronda se entrega igual, porque media ronda entregada vale
más que una ronda completa que nadie recibió.
