# ORDEN DE TRABAJO — RONDA 16

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hitos cubiertos: **H10 (cierre) — las tres correcciones que faltan para instalar** · **H20 — Plantillas del pliego**
Emitida: 2026-08-31

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

El ciclo 15 entregó el paquete, el servicio, el respaldo con destino y el instructivo, y **corrigió la parte difícil del padrón**: la baja, el bloqueo y el cambio de rol en las dos direcciones se reflejan en una sesión ya abierta, sin reingresar, verificado en los cuatro casos con la misma cookie. **352 tests en verde.**

Tres cosas que hiciste bien y quiero nombrar:

1. **La instalación no destruye datos.** Era el riesgo grave de la ronda: instalar sobre una carpeta con expedientes no los toca, es idempotente, el servicio no corre como root, y actualizar o volver atrás nunca tocan `/var/lib/sgc`.
2. **La verificación de arranque comprueba la carpeta de datos escribiendo**, no consultando permisos. Sobre un montaje de red los permisos mienten; escribir no.
3. **El respaldo sobrevive con el padrón adentro.** El auditor destruyó la carpeta de datos y volvieron los expedientes *y las credenciales*. Si no volvieran, después de una restauración real no podría entrar nadie.

### Y lo que falta, que es una tarde

**Se instala apenas publiques esta ronda.** Las tres correcciones del §2 son lo único que separa este sistema de estar corriendo en una máquina de la intranet con catorce personas usándolo.

### Accesos fuera del repositorio

`os.tmpdir()`, puertos locales `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

---

## 1. Alcance

Dos cosas de tamaño muy distinto:

1. **Las tres correcciones** que faltan para poder instalar. Van primero.
2. **H20 — las plantillas del pliego**, versionadas y editables.

---

## 2. Las correcciones · van primero

### 2.1 — La elección de padrón se resuelve al usarlo · **ADR-036**

Leé **ADR-036** completa. Es la tercera vez que aparece la misma forma y ahora tiene regla propia.

```js
function crearServidor(datosDir) {
  const tienePadronReal = padronVivoReal.existe();   // ← se decide UNA vez
  if (tienePadronReal) { padronVivo = padronVivoReal; }
  else { padronVivo = crearPadronVivo(usuariosEjemplo); }
}
```

Ese `existe()` corre al crear el servidor. **Si el padrón real aparece un minuto después, el proceso sigue atado al padrón de ejemplo hasta que alguien lo reinicie** — y nadie va a saber que hay que reiniciarlo, porque no hay error: los operadores entran y cada transición devuelve 403.

Corregilo en dos partes, y la segunda importa más que la primera:

- **La elección se resuelve en cada uso**, del mismo lado de la caché por fecha de modificación que ya tiene el módulo de padrón vivo. No al crear el servidor.
- **Sin padrón real, el servidor no arranca.** El modo declarado **deja de activarse por omisión**: sólo se activa pidiéndolo explícitamente —una opción de línea de comandos o de configuración— y es para desarrollo y tests. *Un modo degradado que se elige solo y no avisa es indistinguible de un defecto.*

Eso último toca los tests, que hoy dependen de que el modo declarado sea el que sale por defecto. **Arreglá los tests, no ablandes la regla**: que pidan el modo que necesitan.

### 2.2 — El comando de siembra del padrón está roto

`INSTRUCTIVO.md` §7 dice:

```
node padron.js --datos /var/lib/sgc --archivo config/usuarios.ejemplo.json --clave SGC-2026
```

`--archivo` espera líneas `nombre;apellido;email;rol;sector;activo`, y ese archivo es un JSON. El auditor lo corrió: falla en todas las líneas y no escribe nada. **Es el único comando roto del manual, y es el que hace falta el día uno.**

Corregí el manual: mostrá **el formato de líneas con punto y coma**, con un ejemplo concreto de dos o tres renglones, y sacá la referencia a `usuarios.ejemplo.json`.

Y de paso: **la sección §8 del manual recomienda ese mismo comando** para cuando las transiciones dan 403. Corregila también.

### 2.3 — El error de V8 se filtra en inglés

Con el padrón presente pero ilegible, el mensaje sale así:

```
…no se pudo leer: Expected property name or '}' in JSON at position 2 (line 1 column 3)
```

Es el único mensaje de arranque que rompe la regla del castellano, y viene de concatenar `e.message`. Decí lo que le sirve a quien lo lee: *"el padrón no es JSON válido: revise el contenido de padron.json"*.

**Y revisá si hay otros lugares donde se concatena un mensaje de error de la máquina** a un texto nuestro. Si hay, es el mismo defecto.

### 2.4 — El instructivo ordena primero el padrón

Hoy el manual instala y arranca el servicio en el §2 y siembra el padrón en el §7. Con la corrección del §2.1 el sistema lo hace cumplir —no arranca sin padrón— pero **el manual tiene que decirlo donde se lee**, no en una nota al pie: **primero el padrón, después el servicio.**

---

## 3. H20 — Las plantillas del pliego

Leé **ADR-032** completa, con su enmienda del 28/08, y **`ANALISIS_ERRORES_PLIEGOS.md`**.

### 3.1 — La plantilla es un dato versionado

```
{ id, nombre, contenido, criterios, version, autor, fecha, vigente, notaDeCambio }
```

- **El contenido íntegro en cada versión.** No diffs, no "la última pisa a la anterior". Un pliego producido hace un año tiene que poder reproducirse igual.
- **La versión vigente es una marca, no la última fila**: se puede volver a una anterior sin borrar nada.
- **La nota de cambio es obligatoria.** Cuando la ONC modifique otro artículo, alguien va a necesitar saber cuándo y por qué se cambió cada cita.

### 3.2 — La selección es una tabla de reglas

Los criterios se van a seguir afinando —lo dijo el Jefe de Contrataciones con todas las letras— así que **agregar un criterio no puede requerir tocar código**:

```
criterios: { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: '*' }
```

- Se evalúa contra los atributos del expediente. `'*'` es comodín.
- **Precedencia explícita**: gana la más específica —menos comodines—; ante empate, la de mayor prioridad declarada. **Nunca "la primera del archivo".**
- **Siempre hay una por defecto**, y cuando se usa por falta de coincidencia **se dice en pantalla**. Ningún expediente queda sin plantilla en silencio.

### 3.3 — Probar antes de publicar, sin salir de la pantalla

Un botón **"Probar ahora"** en la misma pantalla de edición, que lo corre el que está editando —que la mayoría de las veces va a ser el Jefe de Contrataciones—:

1. **Extrae los marcadores** de la plantilla y los contrasta contra los campos que la aplicación sabe emitir. **Un marcador desconocido impide publicar**, con su nombre en el mensaje.
2. **Avisa —sin impedir— de los campos que la aplicación emite y la plantilla no usa.** Puede ser deliberado; puede ser una cláusula que se quedó afuera.
3. **Genera un pliego de prueba** con un expediente de ejemplo. Si no sale, no se publica.

Recién con la prueba en verde se habilita publicar. **Sin esto, una plantilla con un marcador mal escrito produce pliegos defectuosos para todos los expedientes siguientes**, y nadie lo nota hasta que lo lee un proveedor.

### 3.4 — Quién puede

`contrataciones_supervisor` o `juridica`, **cualquiera de los dos, sin aprobación del otro**, verificado en el servidor con la matriz de ADR-021 y registrado como evento. Los demás roles **ven** plantillas e historial: que sea auditable importa más que que sea restringido.

Y la pantalla avisa, antes de publicar, que **el cambio afecta todos los pliegos siguientes**.

### 3.5 — El expediente estampa qué plantilla lo produjo

Id y versión, en el expediente y en el registro de eventos. Sin eso, dentro de dos años nadie puede explicar por qué dos pliegos del mismo tipo salieron distintos.

### 3.6 — Al exportar se entrega la plantilla

El YAML **y el archivo de la plantilla vigente**. El generador usa esa, no la de su carpeta.

### 3.7 — Lo que falta para que "servicios" exista

Hoy `tipo_contrato: 'bienes'` y `tipo_documento: 'proyecto'` están **escritos a mano** en `views/pliego-yaml.js`.

- Los dos se derivan del expediente.
- Y el generador **exige dos campos más cuando el tipo es `servicios`**: `plazo_entrega_servicio` y `garantia_servicio`. **No los emitimos.** Mientras no los emitas, un pliego de servicios no se puede generar — y hoy está tapado justamente porque el campo está fijo.

### 3.8 — La v1 de las plantillas: las trece correcciones normativas

Esto es **el contenido**, no una tarea de programación. `ANALISIS_ERRORES_PLIEGOS.md` clasificó los 24 errores tipificados del log de la División: **trece son citas normativas equivocadas que se arreglan escribiendo bien la plantilla una vez** (N01, N03 a N11, N13, M01, M02).

Cargalos en la v1 de cada plantilla, con la corrección que el log indica, y **la nota de cambio citando el código del error**. El Jefe de Contrataciones y el Asesor Jurídico los van a revisar después; vos dejá la estructura y el texto propuesto.

Y una que sale gratis: **la plantilla numera sola** cláusulas e incisos en vez de traer los números escritos a mano. Eso hace imposibles E01, E02 y E05 del log.

### 3.9 — Las plantillas entran en el respaldo

Son un tipo de dato nuevo que no es un expediente. Respaldo, restauración, y verificado como los demás.

---

## 4. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. **Sin padrón real, el servidor no arranca** y dice qué falta.
2. El modo declarado **sólo se activa pidiéndolo**.
3. Si el padrón aparece **después** de crear el servidor, **el servidor lo toma** sin reiniciar.
4. Ningún mensaje de arranque contiene texto en inglés ni de la máquina.
5. Una plantilla con un **marcador desconocido no se puede publicar**, y el mensaje dice cuál.
6. Una plantilla que no genera el pliego de prueba **no se publica**.
7. La tabla de reglas elige **la más específica**; ante empate, la de mayor prioridad.
8. Un expediente que no coincide con ninguna regla **usa la de defecto y lo dice**.
9. Publicar una versión **no borra la anterior**; se puede volver a una previa.
10. El expediente **estampa id y versión** de la plantilla, con su evento.
11. `tipo_contrato` y `tipo_documento` **se derivan del expediente**.
12. Un expediente de **servicios** emite `plazo_entrega_servicio` y `garantia_servicio`, y **el generador real produce el pliego**.
13. Sólo `contrataciones_supervisor` y `juridica` publican, verificado contra el servidor.
14. Las plantillas sobreviven respaldo y restauración.
15. La suite completa termina en verde de una sola pasada.

---

## 5. `INFORME-RONDA-16.md` — las nueve secciones

En la §2, tres cosas explícitas:

- **cómo quedó la elección de padrón**, y qué tests tuviste que cambiar por el modo declarado;
- **cómo extraés los marcadores** de una plantilla y contra qué los contrastás;
- **qué correcciones del log cargaste** en la v1 de cada plantilla, y cuáles no y por qué.

---

## 6. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. Documentación de sólo lectura: **ADR-021 a ADR-036**, las órdenes y `referencias/`.

```
node --test
node tools/check-compat.js
git add -A
git commit -m "Ronda 16 - Correcciones de despliegue y H20 plantillas del pliego"
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
| 3 | **Sin padrón real** | El servidor **no arranca**, y dice qué falta |
| 4 | Padrón creado después | El servidor lo toma **sin reiniciar** |
| 5 | Modo declarado | Sólo se activa pidiéndolo |
| 6 | Comando de siembra del instructivo | **Funciona tal como está escrito** |
| 7 | Mensajes de arranque | Todos en castellano, sin texto de máquina |
| 8 | Marcador desconocido | **Impide publicar**, con su nombre |
| 9 | Pliego de prueba | Si no sale, no se publica |
| 10 | Tabla de reglas | Precedencia por especificidad; defecto avisado |
| 11 | Versiones | La anterior no se borra; se puede volver |
| 12 | Estampa en el expediente | Id y versión, con evento |
| 13 | `tipo_contrato` / `tipo_documento` | Derivados del expediente |
| 14 | Pliego de **servicios** | **El generador real lo produce** |
| 15 | Quién publica | Sólo los dos roles, verificado en el servidor |
| 16 | Plantillas en el respaldo | Sobreviven restauración |
| 17 | Archivos sobre 400 líneas | Ninguno |
| 18 | Informe con las nueve secciones | Completo |

---

## 8. Qué se está evaluando

Dos cosas, y la primera es más chica y más urgente que la segunda.

**Que el día de la instalación no sea la tarde mala.** Tres correcciones que por separado son menores y juntas producen un sistema que arranca, deja entrar a todos, y no funciona sin decir por qué. Apenas publiques, esto se instala en una máquina de la intranet y lo empiezan a usar catorce personas.

**Y que una plantilla mal escrita no pueda publicarse.** Las plantillas son el único lugar del sistema donde un error de una persona se multiplica por todos los expedientes siguientes — y donde el que lo descubre es un proveedor leyendo un pliego. Por eso la validación no es un accesorio: **es el hito.**

Pesa, en este orden: (1) que sin padrón no arranque, (2) que el comando del manual funcione, (3) que un marcador desconocido impida publicar, (4) que el pliego de servicios salga del generador real, (5) las trece correcciones normativas en la v1.
