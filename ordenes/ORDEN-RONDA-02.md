# ORDEN DE TRABAJO — RONDA 2

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H2 — Núcleo de dominio (sin interfaz)**
Emitida: 2026-08-13

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`: misma jerarquía de precedencia documental, mismo criterio frente a las contradicciones (se reportan, no se resuelven por cuenta propia), y no hay un humano disponible durante la ejecución.

**Novedad: `InstruccionesCodigo.md` fue restaurado al repositorio.** En la ronda 1 el archivo no estaba, y eso obligó a derivar información de otras fuentes. Ahora está disponible. Sigue siendo un documento **parcialmente derogado** —la tabla §3 de `AUDITORIA_InstruccionesCodigo.md` dice qué secciones no se aplican—, pero las que siguen vigentes ya se pueden leer directamente. **§10.1 (roles) es una de ellas.**

---

## 1. Alcance de esta ronda

El núcleo de dominio: las reglas del negocio, puras, testeadas y sin ninguna dependencia del navegador. Debe poder ejecutarse entero bajo Node.

Es el activo más duradero del proyecto: sobrevive a cualquier cambio de interfaz o de infraestructura. Todo lo que se construya después se apoya acá.

**Prohibido adelantarse.** Nada de servidor, interfaz, catálogo, vistas ni adaptadores de persistencia. Si te sobra capacidad, usala en los tests y en el informe.

---

## 2. Correcciones arrastradas de la ronda 1 (obligatorias)

Se ejecutan **antes** del trabajo nuevo. Aplican a todos por igual; si alguna ya está resuelta en tu repositorio, verificalo y dejalo asentado en el informe.

### 2.1 — Suite adversaria del guardián — `tests/check-compat.test.js`

**Es la corrección más importante de esta ronda.**

Tu `tools/check-compat.js` pasa sobre tu propio repositorio. Eso no prueba que funcione: prueba que tu repositorio está limpio. Un verificador que nunca vio una violación no está verificado.

Escribí una suite que, para **cada** ítem de la lista de veto, genere un archivo temporal con esa violación, corra el guardián y verifique que la detecta. Requisitos:

- Cubre las tres familias: JavaScript, CSS y **HTML**.
- Cubre explícitamente la detección de **URLs absolutas `http://` y `https://`** dentro de `app/` (ADR-018).
- Cubre `import`, `export` y `<script type="module">`.
- Verifica también los **falsos positivos**: una violación escrita dentro de un comentario o dentro de un literal de cadena **no** debe reportarse.
- **Cada caso corre con un límite de tiempo explícito.** Si el guardián no responde en menos de 5 segundos sobre un archivo de menos de 50 líneas, el test falla. Un portón de compilación que se cuelga es peor que uno que no detecta: no falla, deja la corrida colgada sin diagnóstico.
- Los archivos temporales se crean y se eliminan dentro del test. No ensucian el repositorio.

Si la suite descubre que tu guardián falla en algún caso, **arreglá el guardián**. Documentá en el informe qué encontraste y qué era la causa.

### 2.2 — Entregables faltantes

Verificá que existan todos los archivos exigidos por `ORDEN-RONDA-01.md` §2. Si falta alguno, crealo ahora.

### 2.3 — Reconciliación de roles

Ahora que `InstruccionesCodigo.md` está disponible, comparás los identificadores de rol de tu `config.js` contra **§10.1**. Si difieren, tenés dos caminos válidos:

- adoptar los identificadores de §10.1, o
- **justificar por escrito** en el informe por qué tu nomenclatura es preferible, y dejarla.

Lo que no es válido es la divergencia silenciosa. Si cambiás los identificadores, actualizá todo lo que los referencia y verificá que los tests de la ronda 1 sigan pasando.

---

## 3. Entregables nuevos

Las firmas están dictadas y son **obligatorias**: se van a verificar con una batería externa. Podés agregar funciones auxiliares, no cambiar las que se piden.

### 3.1 — `app/js/core/estados.js` — motor de transiciones

```js
SGC.core.estados.obtener(idEstado)
// -> objeto del estado, o null si no existe

SGC.core.estados.puedeAvanzar(expediente, rolOperador)
// -> { permitido: bool, motivo: string|null, destinos: [idEstado] }
//    motivo es null si permitido === true; si no, explica en español por qué no.

SGC.core.estados.avanzar(expediente, rolOperador, idDestino, contexto)
// -> { ok: bool, expediente: objeto|null, error: string|null }

SGC.core.estados.puedeDevolver(expediente, rolOperador)
// -> { permitido: bool, motivo: string|null, destinos: [idEstado] }

SGC.core.estados.devolver(expediente, rolOperador, idDestino, idMotivo, observacion, contexto)
// -> { ok: bool, expediente: objeto|null, error: string|null }
```

Donde `contexto` es:

```js
{ email: 'nombre.apellido@faa.mil.ar', rol: 'contrataciones', timestamp: '2026-08-13T14:05:00.000Z', equipo: 'PC-CONTRAT-03' }
```

Reglas no negociables del motor:

1. **Funciones puras.** No mutan el `expediente` recibido: devuelven un objeto nuevo. Un test va a verificar que el original queda intacto después de `avanzar`.
2. **Nada de `Date.now()` ni `new Date()` dentro de `core/`.** El instante llega en `contexto.timestamp`. Es lo que hace el núcleo testeable de forma determinista, y además evita depender del reloj de cada puesto para valores de integridad (`InstruccionesCodigo.md` §14, último punto, que sigue vigente).
3. **La identidad del operador es el correo** (ADR-017), no el rol ni un nombre de usuario.
4. `avanzar` falla —devolviendo `ok:false` y un error legible en español— si: el destino no está en `estadosSiguientes`, el rol no es el `rolEjecutor` del estado actual, o la validación de §3.2 no pasa.
5. `devolver` exige `idMotivo` perteneciente al catálogo cerrado de `config.js`. Sin motivo válido, falla.
6. **Toda transición exitosa agrega una entrada de auditoría** (§3.3) al expediente devuelto, antes de retornar.

### 3.2 — `app/js/core/validacion.js`

```js
SGC.core.validacion.validarParaAvanzar(expediente)
// -> { valido: bool, faltantes: { campos: [string], entregables: [string] } }

SGC.core.validacion.validarRenglon(renglon)
// -> { valido: bool, errores: [string] }
```

`validarParaAvanzar` deriva las exigencias de `camposRequeridos` y `entregablesObligatorios` del estado actual. Como en la ronda 1 esos arreglos quedaron vacíos, la función debe funcionar correctamente **con arreglos vacíos** (todo válido) y con arreglos poblados. No los pueble por su cuenta.

`validarRenglon` aplica la enmienda de ADR-014: `codigo` obligatorio, `cantidad` numérica positiva, `unidad` presente, y `aclaracion` opcional de **máximo 200 caracteres**. La validación del código contra el catálogo real **no** es de esta ronda: acá sólo se valida forma.

### 3.3 — `app/js/core/auditoria.js`

```js
SGC.core.auditoria.hash(texto)
// -> string determinista. Mismo texto, mismo hash, siempre.

SGC.core.auditoria.crearEntrada(entradaPrevia, datos)
// -> { timestamp, email, rol, equipo, accion, de, a, motivo, observacion, hashPrevio }

SGC.core.auditoria.verificarCadena(auditLog)
// -> { integra: bool, rotaEn: number|null }
```

Sobre el alcance de la garantía, leé **ADR-006** antes de escribir una línea. La cadena de hash detecta **edición casual y corrupción**; no resiste manipulación deliberada, porque el hash no es criptográfico y el algoritmo es público.

**Está prohibido escribir "inmutable" o "no repudio" en comentarios, mensajes o nombres de función.** Documentar una garantía que no existe es peor que no tenerla: induce a confiar en ella en una discusión disciplinaria. Describí lo que la cadena hace realmente.

`verificarCadena` debe devolver el índice de la primera entrada cuya cadena no cierra, o `null` si está íntegra.

### 3.4 — `app/js/core/migraciones.js`

```js
SGC.core.migraciones.VERSION_ACTUAL      // number
SGC.core.migraciones.migrar(documento)
// -> { documento: objeto, aplicadas: [string] }
```

Migra hacia adelante y **nunca descarta datos** (`InstruccionesCodigo.md` §4.10, vigente). Un campo que ya no se usa se conserva; uno nuevo se agrega con valor por defecto.

Como caso concreto de prueba, definí la migración del esquema original de `InstruccionesCodigo.md` §6.1 (`schemaVersion: 1`) al esquema corregido de `ORDEN-RONDA-01.md` §2.6, que incorpora `catalogoVersion` y los renglones con `aclaracion`. Dejá `esquemas/datos.v1.ejemplo.json` con un documento en el formato viejo para que el test lo consuma.

### 3.5 — Tests

Además de la suite adversaria de §2.1, y conservando en verde todo lo de la ronda 1:

1. **Matriz estado × rol.** Para los 18 estados: el rol correcto puede avanzar; **todos los demás roles no pueden**. Es el test que le da sentido a la separación de responsabilidades.
2. Avanzar a un destino que no figura en `estadosSiguientes` falla.
3. Devolver sin motivo, o con un motivo fuera del catálogo, falla.
4. **Pureza:** después de `avanzar`, el expediente original no cambió.
5. **Determinismo:** dos llamadas a `avanzar` con el mismo `contexto` producen exactamente el mismo resultado, incluida la entrada de auditoría.
6. **Cadena de auditoría:** una cadena bien formada da `integra:true`; alterar el campo de una entrada intermedia da `integra:false` con el `rotaEn` correcto.
7. **Migración:** un documento `schemaVersion: 1` migrado conserva todos sus campos originales y suma los nuevos.
8. **Recorrido completo:** simulá un expediente que atraviesa los 18 estados cambiando de rol en cada paso, con al menos una devolución y su posterior reavance. Al final, la cadena de auditoría debe verificar y el recorrido debe quedar reflejado en ella.

El punto 8 es el test que más me interesa: es el sistema haciendo lo que existe para hacer.

### 3.6 — `INFORME-RONDA-02.md`

Mismas seis secciones que en la ronda 1, más una séptima:

```
## 7. Autoauditoría del guardián
Qué encontró tu suite adversaria al correr contra tu propio check-compat.js:
qué casos fallaban, cuál era la causa técnica y qué cambiaste. Si no falló
ninguno, decilo y mostrá la salida.
```

No borres ni modifiques `INFORME.md` de la ronda 1.

---

## 4. Reglas de conducta

Las siete de `ORDEN-RONDA-01.md` §3 siguen vigentes sin cambios. Recordatorio de las dos que más pesan acá:

- **Bajo radio de impacto.** La documentación sigue siendo de sólo lectura. `tools/scraper-catalogo/` no se toca. El código de la ronda 1 se modifica sólo donde esta orden lo pide.
- **Commit local, sin push.** Un solo commit, mensaje `Ronda 2 — H2 Nucleo de dominio`.

---

## 5. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` | Todo en verde, incluidos los tests de la ronda 1 |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | Suite adversaria del guardián | Detecta las tres familias, sin falsos positivos, sin exceder los tiempos |
| 4 | Firmas de §3.1 a §3.4 | Presentes y con la aridad exacta pedida |
| 5 | `Date.now(` / `new Date(` dentro de `app/js/core/` | Cero coincidencias |
| 6 | Las palabras "inmutable" / "no repudio" en el código | Cero coincidencias |
| 7 | Pureza de `avanzar` y `devolver` | El expediente de entrada no se modifica |
| 8 | Documentación y scraper | Sin modificar |
| 9 | `INFORME-RONDA-02.md` con sus 7 secciones | Completo |

Los entregables se van a someter además a una **batería de conformidad externa** que ejercita las firmas de §3 contra casos que no conocés. Por eso las firmas son obligatorias y literales.

---

## 6. Qué se está evaluando

Lo mismo que en la ronda 1, con un agregado: **la capacidad de encontrar defectos propios**. La suite adversaria de §2.1 existe para eso. Un agente que la escribe con rigor va a descubrir que su guardián tenía un agujero; uno que la escribe para pasar, no.

Pesa, en este orden: (1) violaciones de restricción, (2) qué encontró y cómo lo reportó tu autoauditoría, (3) corrección del motor de transiciones bajo la batería externa, (4) calidad y honestidad del informe, (5) cobertura real de los tests, (6) prolijidad.

Trabajo inventado fuera de alcance resta.
