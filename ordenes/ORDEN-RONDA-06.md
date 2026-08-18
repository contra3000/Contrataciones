# ORDEN DE TRABAJO — RONDA 6

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H6 — Tablero Kanban, roles y transiciones**
Emitida: 2026-08-14

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

El ciclo anterior se aprobó **sin condiciones**: las seis correcciones arrastradas quedaron resueltas, la conducta fue impecable y el wizard funciona de punta a punta. Queda un hallazgo de severidad media y dos observaciones, en la §2.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Alcance

Hasta ahora el sistema sabe crear un expediente. Ahora tiene que saber **moverlo**.

Los 18 estados del FSD existen en `config.js` desde la ronda 1 y el motor de transiciones desde la ronda 2, testeados y sin usar. Este ciclo los pone en pantalla: un tablero donde se ve dónde está cada expediente, y los botones que lo hacen avanzar o volver, habilitados según quién sea el operador.

Al cerrar este ciclo tiene que poder recorrerse **un expediente real desde el paso 1 hasta el 18**, cambiando de operador en cada fase, con al menos una devolución y su posterior reavance, y con la cadena de auditoría íntegra al final.

**Fuera de alcance:** la generación de los documentos entregables y el PDF (ciclo 7), el tablero de indicadores y el archivo histórico (ciclo 8).

---

## 2. Correcciones arrastradas (obligatorias, van primero)

### 2.1 — F-05-1 · Retomar un borrador viejo o corrupto revienta

`wizard.js:204` llama a `SGC.catalogo.renglones.cargar(estado.datos.renglones)` sin verificar la forma. Si el borrador guardado no tiene la clave `renglones`, o la tiene en `null`, `renglones.js:196` lanza `Cannot read properties of undefined (reading 'length')`.

El usuario ve el aviso de borrador, hace clic en *Retomar*, los campos de texto se llenan, y el flujo muere antes de avanzar de paso: queda con el formulario a medio llenar, el aviso oculto y una excepción en consola.

El borrador es dato del usuario guardado en `sessionStorage` y puede venir de cualquier versión anterior del formulario. **Validá su forma interna antes de aplicarlo**, no sólo que `operador` sea una cadena y `datos` un objeto. Un borrador que no se puede aplicar tiene que producir un mensaje legible y **seguir ofrecido**, no desaparecer.

Los tests `auditoria/tests-adversarios/a7-borrador-viejo.test.js` del auditor reproducen exactamente los dos casos. No los copies: escribí los tuyos en `tests/` y verificá que cubren lo mismo.

### 2.2 — R-05-1 · No bajes 2,5 MB al cliente para validar códigos

`app/catalogo/codigos.json` pesa 2,5 MB y se descarga —sin comprimir, a una PC con Windows 7 y Chrome 109— cada vez que alguien usa el Fast-Track en una sesión nueva. Que la carga sea diferida está bien y no toca el presupuesto inicial, pero el problema de fondo sigue: es bajar el universo entero para responder una pregunta puntual, que es justo lo que ADR-004 corrigió para el catálogo.

**La solución no es comprimirlo, es no bajarlo.** El servidor ya tiene el catálogo en disco. Agregá:

```
POST /api/catalogo/validar-codigos     {codigos: [...]}
  -> 200 {invalidos: [...], catalogoVersion}
```

El cliente manda la lista de códigos del archivo importado y recibe cuáles no existen. Unos pocos kilobytes en cada dirección, y la validación queda del lado que no se puede eludir.

Reglas: la petición se acota a un máximo razonable de códigos por llamada y lo documentás; si el servidor no está disponible, el Fast-Track avisa que no puede validar y **no acepta el archivo**, en lugar de aceptarlo sin verificar. Cuando `codigos.json` deje de tener consumidores, sacalo del build.

### 2.3 — Corrección a un criterio mío

El criterio 6 del ciclo anterior pedía cero ocurrencias de `estadoActual` en `app/`. Era **incompatible con la migración v1→v2**, que por definición tiene que leer ese campo. Hiciste bien en conservar las dos ocurrencias de `migraciones.js` y documentar la excepción en vez de resolverlo por tu cuenta.

Queda corregido: la prohibición aplica a `app/js/**` **excepto `migraciones.js`**. No hay nada que hacer, más que saber que la excepción es legítima y no hace falta volver a justificarla.

---

## 3. Entregables nuevos

### 3.1 — `app/js/views/kanban.js` — el tablero

Columnas por **fase** (las diez del FSD), no por estado (ADR-010): dieciocho columnas obligan a desplazamiento horizontal permanente y destruyen la conciencia situacional que el FSD §1 pone como objetivo. El estado puntual va como etiqueta dentro de la tarjeta.

- Las tarjetas se arman **exclusivamente desde `GET /api/indice`** (ADR-005). El tablero **nunca** abre los `datos.json` en masa.
- Cada tarjeta muestra: número de expediente, título, estado puntual, fase, último operador y fecha de última modificación.
- Filtro por texto y por fase.
- **Visibilidad global para todos los roles** (FSD §3): cualquiera ve el tablero completo. Lo que cambia por rol es qué se puede *hacer*, no qué se puede *ver*.
- **Sin arrastrar y soltar** (FSD §4, `InstruccionesCodigo.md` §5.3). El movimiento es por botón.

### 3.2 — `app/js/views/expediente.js` — la vista de tarjeta

Al abrir una tarjeta: los datos del expediente, sus renglones, su historial de auditoría legible, y los botones de acción.

- **Avanzar**: habilitado sólo si `SGC.core.estados.puedeAvanzar` lo permite para el operador activo. Si no, el botón está deshabilitado **y dice por qué** — el motivo ya viene en la respuesta del motor, mostralo.
- **Devolver por observación**: abre un diálogo que exige elegir un motivo del catálogo cerrado de `config.js` y permite una observación. Sin motivo válido no se puede confirmar.
- Si hay más de un destino posible, el operador elige.
- El historial de auditoría se muestra en orden cronológico, con quién (correo), qué, cuándo y desde qué equipo.

### 3.3 — Conflicto de concurrencia visible

Es lo que el servidor viene resolviendo bien desde la ronda 3 y nunca se vio en pantalla.

Cuando `guardarExpediente` devuelve `{conflicto:true}`, el usuario tiene que ver un mensaje claro —*"El expediente fue modificado por otro operador"*— y una acción para recargar. **Nunca una excepción, nunca una sobrescritura silenciosa.**

Escribí un test que fuerza el conflicto de verdad, con dos guardados sobre la misma versión, y verifica que la vista muestra el aviso.

### 3.4 — Un expediente de punta a punta

`tools/recorrido-completo.js`: un script que, contra un servidor real, crea un expediente y lo lleva del paso 1 al 18 cambiando de operador en cada fase, con al menos una devolución y su reavance.

Al terminar imprime el recorrido y verifica que `SGC.core.auditoria.verificarCadena` da íntegra. Es la demostración de que las piezas de cinco ciclos encajan.

### 3.5 — Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. Borrador con `renglones` ausente, `null`, o de tipo equivocado: mensaje legible, el borrador sigue ofrecido, sin excepción.
2. Fast-Track: con el servidor caído, el archivo **no se acepta** y se avisa.
3. `POST /api/catalogo/validar-codigos` devuelve los inexistentes y sólo esos.
4. El tablero se arma sólo desde el índice: ningún `datos.json` se lee para pintarlo.
5. Matriz de permisos en la vista: para cada uno de los 18 estados, el rol correcto ve el botón habilitado y los demás lo ven deshabilitado con motivo.
6. Devolución sin motivo, o con un motivo fuera del catálogo: bloqueada.
7. Conflicto de versión: la vista muestra el aviso y ofrece recargar.
8. Recorrido completo de los 18 estados con una devolución: termina con la cadena de auditoría íntegra.

### 3.6 — `INFORME-RONDA-06.md`

Las nueve secciones del ciclo anterior. En la 7 (mediciones), incluí el tiempo de carga del tablero con 100 expedientes en el índice.

---

## 4. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. La documentación sigue siendo de sólo lectura.

Cierre: `node --test` y el guardián en verde **en un clon limpio**, informe completo, **un solo commit** con mensaje `Ronda 6 — H6 Kanban roles y transiciones`, sin push, `git status` limpio.

---

## 5. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en un clon recién hecho | Todo en verde |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | Borrador inválido | Mensaje legible, borrador conservado, sin excepción |
| 4 | Fast-Track sin `codigos.json` en el cliente | Valida por servidor; sin servidor, no acepta |
| 5 | El tablero se arma sólo desde `GET /api/indice` | Ningún `datos.json` leído |
| 6 | Columnas del tablero | Diez fases, no dieciocho estados |
| 7 | Matriz de permisos, los 18 estados | El rol correcto habilitado; el resto, deshabilitado con motivo |
| 8 | Devolución sin motivo válido | Bloqueada |
| 9 | Conflicto de versión | Aviso legible y opción de recargar |
| 10 | `node tools/recorrido-completo.js` | Los 18 estados, con devolución, cadena íntegra |
| 11 | Carga del tablero con 100 expedientes | Por debajo de 1 segundo |
| 12 | `INFORME-RONDA-06.md` con sus 9 secciones | Completo |

Se va a correr una **batería externa** que levanta el servidor, recorre los 18 estados por la API y verifica la auditoría resultante.

---

## 6. Qué se está evaluando

Que la División pueda ver dónde está cada trámite y moverlo sin equivocarse de mano. El FSD pone la conciencia situacional entre sus tres objetivos, y este es el ciclo que la entrega.

Pesa, en este orden: (1) el recorrido completo de los 18 estados con la auditoría íntegra, (2) que la matriz de permisos sea correcta en los dieciocho, (3) las dos correcciones arrastradas, (4) que el conflicto de concurrencia se vea y se entienda, (5) honestidad del informe, (6) prolijidad.

Un botón que deja avanzar a quien no corresponde es peor que un botón que no funciona: el segundo se nota, el primero no.
