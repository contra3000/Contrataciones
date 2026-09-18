# ACOTACIÓN — `ORDEN-RONDA-22-AUDITORIA.md`

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Emitida: 2026-09-18

> **Qué es este documento y qué no es.**
>
> **No es una orden.** No reemplaza, no corrige y no reescribe una sola palabra de
> `ORDEN-RONDA-22-AUDITORIA.md`, que sigue en vigencia íntegra en todo lo que no
> diga acá. **Sólo quita alcance**, y sólo por un hecho posterior a su emisión:
>
> **La ronda 22 se entregó con §1 solamente.** El 17/09 una falla del proveedor de
> modelos cortó la sesión del desarrollador; §2 y §3 nunca empezaron y pasaron
> completos a la `ORDEN-RONDA-23.md`. La orden de auditoría se escribió el 16/09
> para una ronda de tres puntos que no ocurrió.
>
> Si hiciera falta **agregar** alcance, no sería esto: sería una ronda nueva con su
> número. Ver §3.12 del `CICLO_DE_TRABAJO.md`.

---

## 0. Tres hechos que no podés saber leyendo el repositorio

**`INFORME-RONDA-22.md` lo escribí yo, el revisor, no el desarrollador.** Está
dicho en su primer párrafo. La sesión del desarrollador quedó cortada con el
trabajo hecho y sin commitear, y lo cerré yo para que no se perdiera.

- **No es testimonio del desarrollador.** No busques contradicciones entre lo que
  dice y lo que él declaró: no declaró nada, la sesión se cortó a la mitad.
- **Lo que ese informe afirma sobre el código lo verifiqué yo sobre el disco**,
  archivo y línea. Contrastarlo a mí es más útil que contrastarlo a él: **yo
  también escribo las órdenes**, y adentro del ciclo no me contrapesa nadie salvo
  vos.
- **El commit `Ronda 22` lo armó un archivo `.bat` que escribí yo**, con una lista
  de archivos hecha a mano, y el push lo corrió el Jefe de Contrataciones. Tu
  control de entrega de §1 alcanza: verificá que ese commit contenga
  **exactamente** lo que el informe dice, ni un archivo de más ni uno de menos. Es
  el control más barato de esta auditoría.

---

## 1. Queda sin efecto: **§3 — El archivo de 20 MB**

No existe. No se escribió una línea. **No lo busques y no lo midas**, y **no lleva
sección en el reporte**: sacá `## El archivo de 20 MB, medido` de la estructura de
§7.

El límite sigue en 2 MB y el archivo sigue viajando como texto adentro de un JSON,
igual que en la ronda 21. Eso **no es un hallazgo tuyo**: está registrado en el
informe y ordenado en la ronda 23.

---

## 2. Se acota: **§4 — los tres experimentos de quitar-la-corrección**

La ronda tocó **un solo lugar**. Tres experimentos sobre un mismo cambio no es
rotación, es repetición.

- **Uno** sobre lo de esta ronda: quitá la guardia de rol de
  `server/expedientes.js:96-101` y comprobá que
  `tests/ronda-22-nacimiento.test.js` se ponga **rojo**. Restaurá, diff cero,
  `node --check`.
- **Dos** de la rotación pendiente de rondas anteriores, los que te tocaban.

Anotá cuáles hiciste y cuáles quedan, para que la rotación no se pierda.

---

## 3. Se acota: **§5 — los barridos**

**B1 se hace igual, y es lo más importante de esta auditoría** (§5 de esta
acotación).

**B2 —el barrido de límites— pierde su contraparte**: el desarrollador nunca lo
hizo, el sub-agente se le cayó dos veces. Hacelo si te da el tiempo, sabiendo que
no vas a poder comparar contra nada y que **le ahorra la pieza 5 a la ronda 23**.
**Si no llegás, no es incumplimiento** — decilo y listo.

### Y los sub-agentes dejan de ser obligatorios

La orden dice *"está confirmado que tu entorno lo permite"*. **Eso quedó desmentido
el 17/09**: el proveedor cortó el acceso gratuito, mató dos veces al sub-agente del
desarrollador e interrumpió sus sesiones. No es configuración de esta máquina y no
hay nada en el repositorio que lo arregle.

Por regla §3.19 del ciclo, nueva:

- Repartí si te sirve, y **sólo barridos de sólo lectura**.
- Si la llamada falla, **un reintento y se acabó**. Después, en serie, como tarea
  separada con su tabla.
- **Un sub-agente caído es un hallazgo, no un accidente**: va al reporte con lo que
  costó.

Nunca experimentos de remoción, nunca servidores, nunca el reporte. Eso no cambió.

---

## 4. Sigue en vigencia, sin cambios

**§0** (reglas de tiempo, y seguís sin manejar el navegador) · **§1** (verificación
de conducta, los ocho de siempre, `MOTIVOS.md`) · **§2.1** (los siete roles contra
la puerta de creación, el rol desde la sesión, el ataque del ciclo 14, los roles
efectivos de ADR-033, el botón del cliente que no es el control) · **§6**
(regresiones, batería completa, los 9 caminos, ningún test tocado) · y el cierre:
un solo commit, `Auditoria ciclo 22`, **sin push**.

---

## 5. Dónde está ahora el valor de esta auditoría · **§2.2**

El barrido B1 del desarrollador encontró que `apiCrear` no era la única puerta sin
guardia. **Yo lo recontrasté** buscando `autorizacion.verificar` en todo
`server/*.js`. Está en `INFORME-RONDA-22.md` §2. Tres puertas, confirmadas por los
dos:

| Extremo | Quién lo verifica hoy |
|---|---|
| `presupuestos.js:38 apiGuardarPresupuesto` | nadie |
| `expedientes.js:224 apiGuardarEntregable` | nadie |
| `pliego-plantillas-api.js` — publicar, estampar, volver, seleccionar | nadie |

Y una que **no tiene guardia a propósito**: `sugerencias.js:156
apiCrearSugerencia`. Es el buzón del piloto. Cerrarla deja al Jefe de
Contrataciones sin el canal por donde llegan los hallazgos que ningún test
encuentra. **Confirmá que sigue abierta.**

**Hacé tu propia lista leyendo el código, antes de mirar ninguna de las dos.**
Después compará contra la del desarrollador **y contra la mía**.

> **Lo que esté en la tuya y no esté en ninguna de las otras dos es el hallazgo de
> esta auditoría.**

Y si aparece una cuarta puerta, **decilo en la primera línea del reporte**. La
**pieza 2 de la ronda 23 cierra exactamente estas puertas**: si son cuatro y no
tres, el Jefe de Contrataciones tiene que saberlo antes de que esa pieza se
escriba. Es lo único de esta auditoría que está bloqueando trabajo.

---

## 6. El reporte

La estructura de `ORDEN-RONDA-22-AUDITORIA.md` §7, **menos** la sección del archivo
de 20 MB, y con dos precisiones dentro de las que ya están:

```
## Los siete roles contra la puerta de creación
Uno por fila: qué mandé, qué contestó.

## Tres listas de puertas: la mía, la del desarrollador, la del revisor
Cada extremo que crea algo: quién puede, quién lo verifica.
Y en la PRIMERA LÍNEA: ¿apareció una cuarta puerta?

## El commit "Ronda 22" contra el informe
Qué archivos entraron, cuáles dice el informe que entraron, si coinciden.
(Es el control de entrega de §1, apuntado a un commit que armó el revisor.)

## Los tres experimentos, y cuáles quedan
Qué quité, qué test corrí, rojo o verde. Y la rotación para la próxima.
```

---

## 7. Lo incómodo, que es el punto

La orden original te pedía **encontrar las puertas que nadie cerró antes de que las
encuentre una persona usando el sistema**. Eso no cambia.

Lo que cambia es quién queda sin control. **Esta ronda la cerró el revisor**:
escribí la orden, verifiqué el código, redacté el informe y armé el commit. Nadie
miró eso salvo vos. Si algo de lo que afirmé no está en el disco como digo que
está, ese es el hallazgo más valioso que podés traer esta ronda — y quiero que lo
busques con esa intención, no de paso.
