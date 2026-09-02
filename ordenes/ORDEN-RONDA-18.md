# ORDEN DE TRABAJO — RONDA 18

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hitos cubiertos: **H21 (cierre)** · **ADR-038 — revisión de valores por omisión**
Emitida: 2026-09-02

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

**Esta es una ronda corta y de precisión. No hay diseño nuevo.** Son cuatro guardias que fallan, tres correcciones medias, y una revisión que las abarca a todas. Nada de esto es difícil: **todo es de pocas líneas y de leer con cuidado**. Por eso el criterio de aceptación de esta ronda no es "funciona", es "no queda ningún caso del mismo tipo en ningún otro lado".

### Lo que hiciste bien y conviene que quede dicho

**La huella del contenido cerró el ataque de verdad.** Atar la prueba al SHA-256 de lo que se publica —y **ignorar por completo** la bandera del cliente— es la solución correcta, no un parche: es la misma forma con que se cerró `contexto.rol` en el ciclo 14. El auditor repitió su ataque del ciclo 16, probó las cinco variantes y buscó una quinta vía. No la encontró. **H20 quedó cerrado.**

**Y el probador dejó de mentir.** Que arme su expediente de ejemplo con la función de exportación real es el arreglo más valioso de la ronda, más que el pliego de servicios en sí: antes tenías un banco de pruebas que devolvía verde sobre un expediente que el sistema nunca iba a poder emitir. Un test que pasa sobre una ficción es peor que no tener el test.

También: la lista de roles del instructivo se **borró** —que era lo pedido, no corregirla—, la nota falsa del seed quedó dicha con la verdad, y declaraste en §4 los tres ajustes de tests con su motivo, incluido el de la ronda 16. Eso es lo que hace verificable un informe.

### Lo que no salió, y por qué esta orden se ve así

Los cuatro hallazgos altos del ciclo 17 **son las cuatro cosas que la orden 17 nombró con nombre propio**. Ninguno es un caso de borde que se pasó: los cuatro estaban escritos.

Y hay algo peor que los cuatro juntos, que el auditor no levantó y yo sí:

| Archivo | El comentario dice | El código hace |
|---|---|---|
| `padron-inicial.js:56-58` | *"…o null si …falta la configuración del administrador"* | Nunca devuelve null: completa con defaults |
| `eventos.js:276` / `sugerencias.js:53` | *"la marca de administrador **también** ve el compendio"* | La marca es inalcanzable: devuelve `true` por rol antes |
| `padron-csv.js:169-171` | *"el anti-encierro se chequea **SIEMPRE** respecto de lo que la importación dejaría al final"* | Se chequea sólo si queda exactamente un administrador |

**Escribiste tres veces la regla correcta en castellano y otra cosa en JavaScript**, y después repetiste la versión del castellano en el informe (§1.6). Eso derrota a la revisión por lectura: quien audita leyendo encuentra el comentario, lo da por bueno y sigue. Hicieron falta pruebas contra el servidor vivo para descubrir las tres.

**La regla nueva, y rige desde esta ronda:** *una regla enunciada en un comentario y no en un test que falle al quitarla, no existe.* Si escribís un comentario que dice "siempre", "nunca" o "sólo", **el test que lo sostiene va en el mismo commit**, o el comentario no va.

### Accesos fuera del repositorio

`os.tmpdir()`, `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

---

## 1. El arranque no completa lo que no le dieron · **va primero**

Leé **ADR-038** completa antes de tocar nada, y la enmienda §8 de ADR-037.

### 1.1 — Sin `administrador` válido, no arranca

Hoy `padron-inicial.js:25-46` hace esto:

```js
const nombre   = texto(admin.nombre,   'Administrador');
const apellido = texto(admin.apellido, 'del Sistema');
const email    = texto(admin.email,    'administrador@sgc.local');
const rol      = texto(admin.rol,      'contrataciones_supervisor');
```

Tiene que **fallar el arranque** —antes de escribir nada en la carpeta de datos— cuando el bloque `administrador` falta, está incompleto, o trae un dato inválido:

- **falta el bloque entero** → no arranca;
- **falta `nombre`, `apellido`, `email` o `rol`** → no arranca, y **nombra cuál falta**;
- **`email` que no valida** contra la misma regla que usa la importación → no arranca, y dice cuál es el correo rechazado;
- **`rol` que no está en `config.js`** → no arranca, y **lista los roles válidos** (de `config.js`, no a mano);
- `sector` sigue siendo opcional.

El mensaje tiene que decir **qué falta y dónde ponerlo**, con la ruta del archivo de configuración que se está usando. `"configuración inválida"` no sirve: quien lo lee está instalando por primera vez y no tiene a quién preguntarle.

**Esto sólo aplica cuando hay que crear el padrón.** Si el padrón ya existe, la configuración del administrador es irrelevante y el servidor arranca igual: la persona ya está en el padrón y ahí manda el padrón, no la configuración. Verificá que un `servidor.json` sin bloque `administrador` **siga arrancando** contra una carpeta de datos que ya tiene padrón — si no, rompés todas las instalaciones existentes.

### 1.2 — El instalador escribe el bloque, o falla pidiéndolo

`instalar.sh:63-68` escribe hoy:

```json
{ "datos": "...", "puerto": 8123 }
```

**Ese es el camino que dispara el defecto.** No es un borde raro: es la instalación por el manual.

`instalar.sh` recibe los datos del administrador —por argumentos `--admin-nombre`, `--admin-apellido`, `--admin-email`, `--admin-rol`, o preguntándolos si la terminal es interactiva— y los escribe en `servidor.json`. **Si no los tiene y no los puede pedir, falla y dice cómo pasarlos.** No escribe un archivo incompleto.

Y actualizá `INSTRUCTIVO.md` con el ejemplo completo, con datos que **se vean como datos de ejemplo** (`jperez@faa.mil.ar`, no `administrador@sgc.local`, para que nadie lo copie tal cual).

### 1.3 — La clave, en un recuadro que no se pueda pasar por alto

Hoy salen cuatro líneas con prefijo de máquina en medio del resto del arranque:

```
SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA cuatro-palabras
```

La orden 17 §1.2 pedía **un recuadro**, y ADR-037 §8 lo precisa: bloque enmarcado, líneas en blanco antes y después, **texto en castellano**, y **último bloque de la salida de arranque** — después de `SGC-SERVIDOR-PUERTO`, no antes. Las líneas con prefijo de máquina pueden quedarse para los tests, pero el recuadro es lo que ve la persona.

El criterio de aceptación no es de programa: **alguien que mira la consola por primera vez tiene que verlo sin buscarlo.** Escribí en el informe cómo se ve, pegado tal cual sale.

### 1.4 — La revisión que abarca a las otras · ADR-038

Recorré el código buscando **todo valor por omisión que caiga en una de las tres familias** de ADR-038 —identidad, facultad, guardia— y aplicá la regla. No son sólo los tres casos conocidos.

La prueba para cada uno: **si este valor por omisión estuviera mal, ¿alguien se daría cuenta?** Si la respuesta es no, no puede haber valor por omisión.

Buscá al menos: `|| '`, `|| {`, `? x :` sobre campos de persona o de permiso, `texto(a, b)` y funciones equivalentes, y todo `=== undefined ? <algo> :` en `server/`. **Los que sobrevivan a la revisión van en el informe con el motivo por el que sobreviven** — un valor por omisión de presentación es legítimo, pero tiene que quedar dicho que se lo miró.

---

## 2. La marca de administrador, ahora sí

`eventos.js:277-279` y `sugerencias.js:54-56`:

```js
if (cx.rol === 'contrataciones_supervisor') {
  return true;
}
```

**Ese `return true` sale.** El compendio crudo de eventos y de sugerencias lo ve **quien tiene la marca**, y nadie más. No es un agregado a la regla vieja: **reemplaza** a la regla vieja. Ese era el punto de ADR-037 §3 y estaba dicho con el motivo: hay **dos** personas con rol `contrataciones_supervisor`, y el compendio es texto libre escrito por sus compañeros y desempeño de personas identificadas (R38).

- Un `contrataciones_supervisor` **sin** marca: no ve el compendio de eventos, no ve el de sugerencias, no administra el padrón, no repone claves.
- Un administrador que **no** sea `contrataciones_supervisor`: sí ve las tres.
- **Editar plantillas no cambia** (ADR-032 §5): sigue siendo de `contrataciones_supervisor` o `juridica`. Un administrador sin ninguno de esos dos roles **no publica plantillas**.
- Y la función `esJefe` está duplicada en dos archivos con el mismo cuerpo. **Una sola**, en el lugar que corresponda, y el nombre que diga lo que hace: `esJefe` ya no es cierto — es `tieneMarcaDeAdministrador`.

Mientras estés ahí: el auditor anotó como nota baja que `GET /api/eventos` y `GET /api/sugerencias` sin cuerpo dan `403` hasta para el administrador (`sesion.js:168-180`), y que por eso la aplicación real no llega al compendio. Es preexistente, pero es **el otro lado de la misma puerta**: si arreglás la puerta y no el picaporte, la pantalla del Jefe de Contrataciones sigue vacía. Arreglalo en esta ronda y **probalo desde la pantalla**, no sólo con una petición armada a mano.

---

## 3. La importación · las tres que quedaron

### 3.1 — `activo: "sí"` desactiva a la persona

`padron-csv.js:123`:

```js
: /^(si|true|1|s|y)$/i.test(activo)
```

`sí` con tilde no está. Y `sí` con tilde **es lo que sale de escribir en castellano**: el corrector lo pone, Excel lo autocompleta, y las catorce personas lo van a tipear así. No da error: la persona sale **desactivada** y el diff informa correctamente que se modificó `activo`. **No falla: obedece mal.**

La corrección no es agregar `sí` a la lista. Es esto:

- **Normalizá el valor antes de compararlo**: recorte, minúsculas, y sin tildes (`sí`→`si`, `SÍ`→`si`).
- **Vocabulario cerrado y explícito**, en las dos direcciones: afirmativos `si`, `sí`, `s`, `true`, `1`, `x`, `verdadero`; negativos `no`, `n`, `false`, `0`, `falso`; vacío o ausente = **activo**.
- **Cualquier otra cosa es un error de línea**, con el número de línea y el motivo, y **no se aplica la importación** (todo o nada, que ya funciona). `activo: "tal vez"` no puede resolverse como `false` en silencio. **Este es el punto**: hoy todo lo que no matchea cae en `false`, que es la peor omisión posible — el valor por omisión de un campo booleano de identidad es la desactivación.

Y lo mismo del otro lado: la **exportación** escribe siempre el mismo valor canónico (`si` / `no`), así la ida y vuelta es idéntica.

### 3.2 — El anti-encierro mira el estado final, no el número de hoy

`padron-csv.js:176`:

```js
const adm = adminsActivos(padron);
if (adm.length === 1) {
```

Con dos administradores la guardia **no corre**, y una importación con `desactivarAusentes` que omita a los dos deja el sistema sin ningún administrador activo. Y no es un escenario rebuscado: es exactamente la ventana que abre ADR-037 §6 —*primero se marca al nuevo, después se desmarca al anterior*—, es decir, la protección se apaga justo cuando se está haciendo la operación más delicada del padrón.

La regla correcta no cuenta administradores de hoy. **Calcula el padrón que la importación dejaría, y verifica que en ese padrón resultante haya al menos un administrador activo.** Si no lo hay, `422` con el motivo, sin escribir nada.

Escribilo así, como una sola función que recibe el padrón resultante y responde una pregunta, y usala también en `padron-administracion.js` (`chequearAntiEncierro:96-100` tiene el mismo `<= 1` con la misma lógica de "hoy"). Una sola guardia, en un solo lugar, aplicada sobre el estado final. **Y el test que la sostiene: dos administradores, importación que omite a los dos, `desactivarAusentes` marcado → tiene que fallar.**

### 3.3 — Neutralización de fórmulas en la exportación

`padron-csv.js:47-53`, `csvCampo`, no protege los prefijos `= + - @` ni el tabulador. Es **R32 en la dirección contraria** a la que se cerró en el ciclo 13: un nombre que empieza con `=` sale sin escapar, se ejecuta al abrir el archivo en Excel, y **vuelve a entrar** al reimportarlo.

Aplicá la misma neutralización que ya existe para la exportación de eventos —no escribas una segunda—: **si `views/exploracion.js` o donde esté ya tiene la función, extraela y usala en los dos lados.** Es la forma de ADR-031: no detectar casos, neutralizar todo.

**Y verificá la ida y vuelta**: un nombre `=SUM(A1:A10)` tiene que exportarse neutralizado, importarse de vuelta, y **quedar exactamente igual que al principio en el padrón**. Neutralizar rompiendo el dato no sirve.

### 3.4 — El correo es la identidad, y no distingue mayúsculas

`padron-csv.js:37-41` compara con `===`. `Juan@faa.mil.ar` y `juan@faa.mil.ar` son dos personas distintas para el sistema, y una sola para el servidor de correo.

**Normalizá a minúsculas al entrar** —importación, alta de a uno, y el bloque `administrador` de la configuración— y compará normalizado, en el padrón, en el ingreso y en la búsqueda de la sesión. El correo es la identidad del sistema entero (ADR-017); dos formas del mismo correo son dos cuentas para la misma persona, con dos claves y dos historiales de auditoría.

Un correo repetido dentro del mismo archivo **con distinta capitalización** es un error de línea, igual que el repetido exacto.

### 3.5 — Un tope declarado para la importación

Medido por el auditor: 2.000 líneas ≈ **154 segundos**; 10.000 no termina. El costo está en una búsqueda O(n²) más `scrypt` por línea.

Con catorce personas esto no te va a molestar nunca, así que **no optimices**. Hacé dos cosas y nada más:

- **Un índice por correo** en vez de la búsqueda lineal dentro del bucle. Es una línea y elimina el O(n²).
- **Un tope declarado** —**500 líneas**— con rechazo inmediato y mensaje claro: *"el archivo tiene N líneas y el máximo es 500; el padrón de la División tiene 14 personas"*. Un archivo de diez mil líneas en este sistema es un error, no un caso de uso, y **tomarse dos minutos en descubrirlo es peor que rechazarlo en un segundo**.

`scrypt` por línea sólo corre para altas nuevas, y eso está bien: es el costo de crear una credencial.

---

## 4. Tests

Cada punto de esta orden con su test, y **la regla nueva**: si escribís un comentario con "siempre", "nunca" o "sólo", el test que lo sostiene va en el mismo commit.

Los que no pueden faltar:

1. Configuración sin bloque `administrador` → **no arranca**, y el mensaje nombra el campo.
2. Configuración con `email` inválido → no arranca. Con `rol` inexistente → no arranca, y lista los roles.
3. Configuración sin bloque `administrador` **con padrón ya existente** → **arranca normal**.
4. `contrataciones_supervisor` sin marca → `403` en el compendio de eventos **y** en el de sugerencias.
5. Administrador sin rol de supervisor → `200` en los dos, y `403` al publicar una plantilla.
6. El compendio se abre **desde la pantalla** con la sesión real del administrador.
7. `activo` con `sí`, `SÍ`, ` si `, `no`, `NO`, vacío, `true`, `0`, `x` → el resultado esperado de cada uno.
8. `activo: "tal vez"` → error de línea, **nada se aplica**.
9. Dos administradores activos, importación que omite a los dos con `desactivarAusentes` → `422`, padrón intacto.
10. Dos administradores, importación que desactiva a **uno** → se aplica.
11. Exportar → importar sin tocar nada → **el padrón no cambia en ningún campo** (incluido un nombre con `=`, uno con `;`, uno con tilde y uno con comillas).
12. `Juan@faa.mil.ar` importado sobre un padrón que ya tiene `juan@faa.mil.ar` → **es la misma persona**, no un alta.
13. Archivo de 501 líneas → rechazo con el mensaje del tope.
14. **Y las regresiones enteras**: los 390 de hoy siguen en verde.

---

## 5. `INFORME-RONDA-18.md` — las nueve secciones

Las mismas nueve de siempre. Tres cosas específicas de esta ronda:

- En **§1**, pegá el recuadro de la clave **tal como sale por consola**.
- En **§2**, la lista completa de la revisión de ADR-038: cada valor por omisión que encontraste, en qué familia cayó, y qué hiciste. **Incluí los que dejaste**, con el motivo.
- En **§4**, si alguna de estas correcciones contradice algo escrito en una ADR o en una orden anterior, **decilo y no la hagas**. Ya pasó dos veces que tenías razón.

---

## 6. Cierre

Un solo commit, `Ronda 18`, **y push**. El control de entrega antes de largar al auditor:

```
git log --oneline -1
git log origin/main --oneline -1
git status --short
```

Los dos primeros tienen que dar el mismo hash, y el tercero, vacío. Si el informe no está, el auditor no arranca.

---

## 7. Criterios de aceptación

- Ninguno de los cuatro hallazgos altos del ciclo 17 sobrevive, **y cada uno tiene un test que falla si se revierte la corrección**.
- Los tres medios corregidos, con la ida y vuelta del CSV verificada campo por campo.
- **Ningún comentario del código enuncia una regla que el código no aplique.** Es el criterio nuevo y es el que más miro.
- La revisión de ADR-038 está hecha sobre todo `server/`, no sobre los tres casos conocidos, y está escrita en el informe.
- 390 tests o más, todos en verde.

---

## 8. Qué se está evaluando

Una sola cosa, y es corta de decir: **que lo que dice el código y lo que hace el código sean lo mismo.**

Las cuatro correcciones de esta ronda son de pocas líneas y no tienen dificultad técnica. Lo que se está midiendo no es si podés hacerlas: es si, después de hacerlas, queda algún lugar donde un comentario, un informe o un nombre de función prometan una garantía que el código no da.

Porque de acá a unos días esto lo instala una persona sola, sin nadie a quien preguntarle, y lo único que va a tener para saber qué hace el sistema es lo que el sistema dice de sí mismo.
