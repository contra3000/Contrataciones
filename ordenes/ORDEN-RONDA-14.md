# ORDEN DE TRABAJO — RONDA 14

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H18 — Credenciales, jerarquía de roles y administración del padrón**
Emitida: 2026-08-28

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

**El ciclo 13 cerró sin un solo hallazgo nuevo**, el primero del proyecto. Las tres correcciones cerradas, los dos hitos entregados, 329 tests en verde, y el informe con las nueve secciones.

Tres cosas tuyas que quiero nombrar:

1. **La lista blanca de H14 es lista blanca de verdad** — `RENGLON_BLANCO` con siete campos declarados, no "copiar todo y después borrar". El auditor revisó el `datos.json` del expediente nuevo campo por campo y no encontró **ni un precio** del original.
2. **Bloquear la creación cuando hay códigos dados de baja**, en vez de copiarlos marcados, es más estricto de lo que pedí y es lo correcto.
3. **Tu §5 volvió a producir la tarea del ciclo siguiente.** Declaraste que `GET /api/eventos` sirve el registro crudo sin diferenciar Jefe de operador. Nadie te lo preguntó, y es el §2.4 de esta orden.

### Lo que cambió afuera, y te toca

Llegaron dos respuestas de Informática y una **cambia el modelo de amenaza de esta ronda**:

- **No hay HTTPS. El host sirve sólo HTTP.** La clave del operador **va a viajar en claro por la intranet**. El Jefe de Contrataciones lo acepta —red cerrada, sin datos personales— pero eso obliga a algo concreto que está en §3.7.
- **Las PCs tienen IP fija, pero no hay una PC por persona.** La restricción de rol por máquina **se descarta**: atar el rol a la máquina daría por buena una atribución falsa. H3-12 sale del plan.

Leé **ADR-027** (con su enmienda del 28/08), **ADR-033** y **ADR-034** completas antes de escribir una línea.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más. Esta ronda no toca el generador de pliegos.

---

## 1. Alcance

Las credenciales, y con ellas el paso más importante que le queda al sistema: **que el registro deje de decir quién *dijo* que era y pase a decir quién *era*.**

Hoy el navegador declara *"soy generador"* y el servidor lo cruza contra el padrón. Un operador puede elegir el nombre de cualquiera. Mientras eso sea así, **los tiempos que registramos y los indicadores que calculamos miden una elección de lista**, no a una persona — y el UAT del ciclo 16 produciría datos que no acreditan nada.

**Fuera de alcance:** las plantillas del pliego (H20, ronda 15).

---

## 2. Correcciones

### 2.1 — El esquema de la base

`origenError` valida `estado === PERFECCIONADA` y `archivado === true`, pero no la versión de esquema. Un perfeccionado de un año viejo se acepta como base y `construirPropuesta` completa con valores por defecto. No hay fuga, pero **declaralo**: qué versión de esquema se acepta, y qué pasa si es más vieja (ADR-025 §1).

### 2.2 — El compendio de eventos y de sugerencias es del Jefe de Contrataciones

`GET /api/eventos` sirve hoy el registro crudo a cualquier rol, y lo mismo la vista de sugerencias. Los dos contienen **texto libre escrito por personas identificadas y su desempeño**.

- El **registro crudo de eventos** y el **compendio completo de sugerencias con su contexto** quedan restringidos al rol de mayor jerarquía de Contrataciones. Verificado **en el servidor**, no en la vista.
- Los **indicadores de su propio tablero** los sigue viendo cada rol: lo que se cierra es el acceso al detalle crudo, no a los números.
- Y hacelo **después** de §3, no antes: hasta que exista la sesión autenticada no hay con qué distinguir.

---

## 3. H18 — Credenciales

### 3.1 — Un rol por operador, y los supervisores heredan · **ADR-033**

El padrón pasa de `roles: []` a **`rol: ''`**.

La jerarquía se declara **como dato** en `config.js`, no como una cadena de condiciones:

```
{ rol: 'contrataciones_supervisor', incluye: ['contrataciones'] }
{ rol: 'abastecimiento_supervisor', incluye: ['abastecimiento'] }
```

- `rolesEfectivos(rol)` devuelve el propio más los heredados, **transitivamente**: si mañana hay tres niveles, el de arriba incluye a los dos de abajo sin tocar código.
- **La matriz de 18 × 7 no se duplica.** Sigue diciendo qué rol ejecuta cada paso; lo que cambia es que se pregunta contra el conjunto.
- Migración: los expedientes ya registrados conservan lo que tengan. **No se reescribe historia.**

### 3.2 — La clave, guardada como corresponde

```
credencial: { algoritmo: 'scrypt', sal, N, r, p, hash, provisoria }
```

`node:crypto` — **cero dependencias nuevas**. Comparación con `timingSafeEqual`.

**Ninguna clave en texto plano, en ningún lado, nunca.** Aunque la red sea cerrada: el caso realista no es un atacante, es que el archivo del padrón termine en un respaldo o en una carpeta compartida.

### 3.3 — El padrón con credenciales **no se sirve por HTTP**

Vive fuera de toda carpeta servida como estática, y **hay un test que lo verifica** — no una revisión visual. Un padrón con hashes descargable desde el navegador convierte el punto 3.2 en decorado.

En el repositorio queda `usuarios.ejemplo.json` **sin credenciales**, como hasta ahora. El padrón real vive en la carpeta de datos y entra en el respaldo.

### 3.4 — Sesión

- Cookie `HttpOnly`, `SameSite=Strict`, identificador de `crypto.randomBytes`. **La sesión vive del lado del servidor.**
- Cierre por inactividad a los **15 minutos** (ya decidido en H5-1) y cierre explícito con botón visible.
- El operador activo, su rol y su correo siguen **siempre a la vista** (ADR-017).

### 3.5 — El rol se deriva de la sesión · **la ganancia grande**

**El cliente deja de declarar `contexto.rol`.** Se deriva del operador autenticado. Con un rol por persona (§3.1), no hay nada que elegir.

Y la auditoría y los eventos registran el **rol efectivo**: cuando un supervisor ejecuta un paso de su supervisado, el registro dice `contrataciones_supervisor actuando como contrataciones`. No alcanza con anotar quién: hay que poder reconstruir **con qué facultad** se hizo cada cosa.

**Indicador nuevo:** cuando la **misma persona** ejecuta un paso y su supervisión. **No bloquea nada.** Con catorce personas eso va a pasar y bloquearlo detendría expedientes; lo que hace falta es que se vea.

### 3.6 — Ciclo de vida de la clave · **ADR-034**

Es donde esto se gana o se pierde:

- **Se genera como cuatro palabras en castellano separadas por guiones** — `silla-mapa-trueno-verde` — no como una cadena de símbolos. Una clave que se entrega en papel y se tipea a mano **tiene que poder copiarse sin error**: cuatro palabras de un diccionario de dos mil son más difíciles de adivinar que `X7#kq2` y muchísimo más fáciles de transcribir.
- La herramienta la muestra **una sola vez** y guarda sólo el hash.
- **Nace `provisoria: true`, y el primer ingreso obliga a cambiarla.** Con esa marca el operador entra pero **no puede hacer nada más que cambiar su clave**. Es el punto que hace que todo esto valga: mientras la clave la conozca el Jefe de Contrataciones, el registro **no puede distinguir entre el operador y él**.
- **Reposición:** no hay autoservicio —no hay correo por donde mandar nada—. El Jefe genera otra provisoria y el ciclo vuelve a empezar. **Y la reposición se registra como evento**: *"clave repuesta por X para Y"*. La defensa no es impedirlo, que es imposible cuando administra una sola persona: es que **no se pueda hacer sin dejar rastro**.
- **La baja pone `activo: false`, nunca borra.** El nombre sigue apareciendo en los expedientes que tramitó (R15).

### 3.7 — Lo que hay que decir en pantalla, porque no hay HTTPS

La clave viaja en claro. La pantalla de cambio de clave tiene que decir, con esas palabras: **esta clave no puede ser la misma que usás en ningún otro sistema.** No es una recomendación escondida en un manual — va en la pantalla donde se elige.

### 3.8 — Contra el tanteo, lo mínimo

Demora fija de un segundo en cada intento fallido; bloqueo tras diez fallos seguidos, que **sólo levanta el Jefe de Contrataciones**. A esta escala no hace falta más y cualquier cosa más elaborada estorba.

### 3.9 — `tools/padron.js`

Alta, cambio de clave, reposición, baja. **Imprime la clave una vez y no la guarda en ningún lado.** Y acepta un archivo `nombre;apellido;email;rol;sector;activo` para el alta inicial: el Jefe de Contrataciones va a cargar catorce personas de una vez.

---

## 4. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. **El padrón con credenciales no es alcanzable por HTTP** — probado contra el servidor, no leyendo el código.
2. Ninguna clave en texto plano en disco, en ningún archivo.
3. Un operador **no puede ejecutar una acción con el rol de otro**, verificado contra el servidor.
4. Un `contrataciones_supervisor` **puede** ejecutar un paso de `contrataciones`; un `contrataciones` **no puede** ejecutar uno de supervisor.
5. La auditoría registra el **rol efectivo** cuando el supervisor actúa como supervisado.
6. Con `provisoria: true`, el operador **no puede hacer nada más que cambiar su clave**. Probá todos los extremos, no sólo la vista.
7. Después del cambio, la clave vieja **no sirve**.
8. La reposición **deja un evento** con quién la repuso, para quién y cuándo.
9. La baja pone `activo: false` y **el nombre sigue apareciendo** en los expedientes viejos.
10. Diez fallos seguidos bloquean; el bloqueo lo levanta sólo el Jefe.
11. Cierre por inactividad a los 15 minutos.
12. `GET /api/eventos` y el compendio de sugerencias **rechazan** a un rol que no corresponde.
13. Cada rol sigue viendo **los indicadores de su tablero**.
14. La suite completa termina en verde de una sola pasada.

---

## 5. `INFORME-RONDA-14.md` — las nueve secciones

En la §2, tres cosas explícitas:

- **cómo generás la clave** y de dónde sale el diccionario de palabras;
- **qué pasa exactamente** con una petición de un operador con clave provisoria, extremo por extremo;
- **qué se registra en la reposición** y qué no.

---

## 6. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. Documentación de sólo lectura: **ADR-021 a ADR-034**, las órdenes y `referencias/`.

```
node --test
node tools/check-compat.js
git add -A
git commit -m "Ronda 14 - H18 credenciales y jerarquia de roles"
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
| 3 | Padrón con credenciales | **No alcanzable por HTTP** (test) |
| 4 | Claves en texto plano | Ninguna, en ningún archivo |
| 5 | Jerarquía de roles | Declarada como dato; **la matriz 18 × 7 no se duplica** |
| 6 | Rol en las peticiones | **Derivado de la sesión**; el cliente no lo declara |
| 7 | Rol efectivo en la auditoría | `supervisor actuando como X` |
| 8 | Clave provisoria | Sólo permite cambiarla, verificado extremo por extremo |
| 9 | Formato de la clave | Cuatro palabras en castellano; se muestra una vez |
| 10 | Reposición | Deja evento con quién, para quién y cuándo |
| 11 | Baja | `activo: false`; el nombre no desaparece del historial |
| 12 | Aviso de clave no reutilizada | En la pantalla de cambio |
| 13 | Eventos crudos y sugerencias | Restringidos por rol **en el servidor** |
| 14 | Archivos sobre 400 líneas | Ninguno |
| 15 | Informe con las nueve secciones | Completo |

---

## 8. Qué se está evaluando

**Que el registro deje de basarse en una elección de lista.**

Todo lo que construimos hasta acá —los tiempos, la traza de auditoría, los catorce tipos de evento, los indicadores— descansa sobre saber quién hizo qué. Hoy eso es una declaración. Después de esta ronda es un hecho verificado, y recién entonces el UAT del ciclo 16 va a producir datos que acreditan algo.

Pesa, en este orden: (1) que el rol se derive de la sesión y el cliente no lo declare, (2) que la clave provisoria realmente no deje hacer nada más, (3) que el padrón con hashes no se sirva, (4) la jerarquía sin duplicar la matriz, (5) que la reposición deje rastro.

El punto 2 parece de trámite y es el que sostiene todo: **mientras la clave la conozca el Jefe de Contrataciones, el sistema no puede distinguir entre el operador y él** — y entonces nada de lo anterior significa nada.
